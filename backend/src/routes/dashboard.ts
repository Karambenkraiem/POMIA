import { Router } from 'express';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

type TurbineStatus = 'running' | 'stopped' | 'unknown';

/**
 * Statut turbine déduit des manœuvres de la journée (ordre chronologique) :
 * - "Ordre de démarrage" -> running, jusqu'à un "Ordre d'arrêt" ou "virage" (arrêt turbine/mise sur virage).
 * - Si la toute première manœuvre du jour est "Groupe en production", on part de running (le groupe
 *   tournait déjà avant minuit) — mais seul un "Ordre d'arrêt"/"virage" peut ensuite repasser à stopped.
 */
function computeTurbineStatus(manouvres: { heure_manouvre: Date; description: string }[]): TurbineStatus {
  if (manouvres.length === 0) return 'unknown';
  const sorted = [...manouvres].sort((a, b) => a.heure_manouvre.getTime() - b.heure_manouvre.getTime());

  let status: TurbineStatus = 'unknown';
  if (normalize(sorted[0].description).includes('groupe en production')) {
    status = 'running';
  }

  for (const m of sorted) {
    const d = normalize(m.description);
    if (d.includes('ordre de demarrage')) status = 'running';
    else if (d.includes("ordre d'arret") || d.includes('ordre d arret')) status = 'stopped';
    else if (d.includes('virage')) status = 'stopped';
  }

  return status;
}

router.get('/', async (req, res) => {
  try {
    const { date } = req.query;
    let todayStr: string;
    if (date && typeof date === 'string') {
      todayStr = date;
    } else {
      const now = new Date();
      todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    }
    const today = new Date(todayStr + 'T00:00:00.000Z');

    const [journeeAujourdhui, defautsActifs, otsEnCours, recentReleves] = await Promise.all([
      prisma.journee.findUnique({
        where: { jour: today },
        include: {
          postes: {
            include: {
              chefQuart: { select: { nom: true, prenom: true } },
              chefBloc: { select: { nom: true, prenom: true } },
              operateur1: { select: { nom: true, prenom: true } },
              operateur2: { select: { nom: true, prenom: true } },
            },
          },
          compteurs: true,
          _count: { select: { releves_bloc: true, manouvres: true, alarmes: true } },
        },
      }),
      prisma.materielDefectueux.count({ where: { date_cloture: null } }),
      prisma.ordreTravaux.count({ where: { etat: 'en_cours' } }),
      prisma.relevesChefBloc.findMany({
        orderBy: { heure_releve: 'desc' },
        take: 10,
        include: {
          generateur: {
            select: {
              puissance_active_mw: true,
              puissance_reactive_mvar: true,
              frequence_hz: true,
              cos_phi: true,
              tension_alt_dvx_kv: true,
              tension_svlx_kv: true,
            },
          },
          echappement: { select: { ttxm_moyenne: true, spread_calcule: true, ttxspl_ecart: true } },
          vibrations: { select: { vibration_maxi: true } },
        },
      }),
    ]);

    // Un relevé peut avoir des sections incomplètes (chef de bloc n'a pas
    // encore saisi une zone) : on prend, pour chaque mesure, la dernière
    // valeur non nulle parmi les relevés récents plutôt que de tout figer
    // sur le seul dernier relevé (qui peut être partiel).
    const firstNonNull = <T,>(pick: (r: (typeof recentReleves)[number]) => T | null | undefined): T | null => {
      for (const r of recentReleves) {
        const v = pick(r);
        if (v !== null && v !== undefined) return v;
      }
      return null;
    };

    const dernierReleve = recentReleves[0]
      ? {
          heure_releve: recentReleves[0].heure_releve,
          generateur: {
            puissance_active_mw: firstNonNull((r) => r.generateur?.puissance_active_mw),
            puissance_reactive_mvar: firstNonNull((r) => r.generateur?.puissance_reactive_mvar),
            frequence_hz: firstNonNull((r) => r.generateur?.frequence_hz),
            cos_phi: firstNonNull((r) => r.generateur?.cos_phi),
            tension_alt_dvx_kv: firstNonNull((r) => r.generateur?.tension_alt_dvx_kv),
            tension_svlx_kv: firstNonNull((r) => r.generateur?.tension_svlx_kv),
          },
          echappement: {
            ttxm_moyenne: firstNonNull((r) => r.echappement?.ttxm_moyenne),
            spread_calcule: firstNonNull((r) => r.echappement?.spread_calcule),
            ttxspl_ecart: firstNonNull((r) => r.echappement?.ttxspl_ecart),
          },
          vibrations: {
            vibration_maxi: firstNonNull((r) => r.vibrations?.vibration_maxi),
          },
          temp_ambiante_ctim: firstNonNull((r) => r.temp_ambiante_ctim),
          pression_atm_afpap: firstNonNull((r) => r.pression_atm_afpap),
          vitesse_turbine_rpm: firstNonNull((r) => r.vitesse_turbine_rpm),
        }
      : null;

    const dayOfWeek = today.getUTCDay(); // 0=dimanche .. 6=samedi
    const mondayOffset = (dayOfWeek + 6) % 7;
    const monday = new Date(today.getTime() - mondayOffset * 24 * 3600 * 1000);
    const endOfSunday = new Date(monday.getTime() + 7 * 24 * 3600 * 1000 - 1);

    const puissance7Jours = await prisma.relevesChefBloc.findMany({
      where: { heure_releve: { gte: monday, lte: endOfSunday } },
      select: {
        heure_releve: true,
        generateur: { select: { puissance_active_mw: true } },
      },
      orderBy: { heure_releve: 'asc' },
    });

    const incidentsAujourdhui = journeeAujourdhui
      ? await prisma.manouvre.count({ where: { journee_id: journeeAujourdhui.id, type_manouvre: 'incident' } })
      : 0;

    const manouvresDuJour = journeeAujourdhui
      ? await prisma.manouvre.findMany({
          where: { journee_id: journeeAujourdhui.id },
          select: { heure_manouvre: true, description: true },
          orderBy: { heure_manouvre: 'asc' },
        })
      : [];
    const turbineStatus = computeTurbineStatus(manouvresDuJour);

    const essaisAFaire = journeeAujourdhui
      ? await prisma.essaiInstance.findMany({
          where: { journee_id: journeeAujourdhui.id, statut: 'a_faire' },
          select: { id: true, essai: { select: { nom: true } } },
        })
      : [];

    res.json({
      journeeAujourdhui,
      defautsActifs,
      otsEnCours,
      dernierReleve,
      puissance7Jours,
      turbineStatus,
      incidentsAujourdhui,
      essaisAFaire: essaisAFaire.map((e) => ({ id: e.id, nom: e.essai.nom })),
    });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
