import { Router } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// ===== RELEVES CHEF DE BLOC =====

router.get('/bloc/journee/:journeeId', async (req, res) => {
  try {
    const releves = await prisma.relevesChefBloc.findMany({
      where: { journee_id: req.params.journeeId },
      include: {
        saiseur: { select: { nom: true, prenom: true, matricule: true } },
        generateur: true,
        huile: true,
        vibrations: true,
        echappement: true,
        metal_blanc: true,
      },
      orderBy: { heure_releve: 'asc' },
    });
    res.json(releves);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/bloc/:id', async (req, res) => {
  try {
    const releve = await prisma.relevesChefBloc.findUnique({
      where: { id: req.params.id },
      include: {
        saiseur: { select: { nom: true, prenom: true, matricule: true } },
        generateur: true,
        huile: true,
        vibrations: true,
        echappement: true,
        metal_blanc: true,
      },
    });
    if (!releve) return res.status(404).json({ error: 'Relevé non trouvé' });
    res.json(releve);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Le spread affiché est directement l'écart admissible TTXSPL saisi à la main,
// pas une valeur recalculée à partir des thermocouples.
function withSpreadCalcule(ec: any) {
  if (!ec || typeof ec !== 'object') return ec;
  const v = ec.ttxspl_ecart;
  const n = v === null || v === undefined || v === '' ? null : Number(v);
  return { ...ec, spread_calcule: n !== null && !Number.isNaN(n) ? n : null };
}

router.post('/bloc', async (req, res) => {
  try {
    const { journee_id, poste_id, heure_releve, generateur, huile, vibrations, echappement, metal_blanc, ...main } = req.body;

    // Strip empty sub-objects to avoid creating useless DB rows
    const hasValues = (obj: any) => obj && typeof obj === 'object' && Object.values(obj).some(v => v !== null && v !== undefined && v !== '');
    const echappementCalc = withSpreadCalcule(echappement);

    const releve = await prisma.relevesChefBloc.create({
      data: {
        ...main,
        journee_id,
        poste_id,
        saisi_par: req.user!.userId,
        heure_releve: new Date(heure_releve),
        ...(hasValues(generateur) && { generateur: { create: generateur } }),
        ...(hasValues(huile) && { huile: { create: huile } }),
        ...(hasValues(vibrations) && { vibrations: { create: vibrations } }),
        ...(hasValues(echappementCalc) && { echappement: { create: echappementCalc } }),
        ...(hasValues(metal_blanc) && { metal_blanc: { create: metal_blanc } }),
      },
      include: { generateur: true, huile: true, vibrations: true, echappement: true, metal_blanc: true },
    });
    res.status(201).json(releve);
  } catch (err: any) {
    console.error('[POST /bloc]', err);
    if (err.code === 'P2002') return res.status(409).json({ error: 'Un relevé existe déjà pour cette heure' });
    res.status(500).json({ error: err.message ?? 'Erreur serveur' });
  }
});

// Un sous-objet relu depuis l'API (generateur, huile, ...) contient son propre id et
// releve_id ; Prisma gère ce lien implicitement dans un upsert imbriqué et rejette ces
// champs s'ils sont présents dans les données envoyées.
function stripRelationMeta(obj: any) {
  if (!obj || typeof obj !== 'object') return obj;
  const { id, releve_id, ...clean } = obj;
  return clean;
}

router.put('/bloc/:id', async (req, res) => {
  try {
    const { id, journee_id, cree_le, synced, deverrouille, saiseur, journee, poste, heure_releve,
            generateur, huile, vibrations, echappement, metal_blanc, ...rest } = req.body;
    const main = { ...rest, saisi_par: req.user!.userId, heure_releve: new Date(heure_releve), deverrouille: false };
    const echappementCalc = echappement ? withSpreadCalcule(echappement) : echappement;

    const releve = await prisma.relevesChefBloc.update({
      where: { id: req.params.id },
      data: {
        ...main,
        ...(generateur && {
          generateur: {
            upsert: { create: stripRelationMeta(generateur), update: stripRelationMeta(generateur) },
          },
        }),
        ...(huile && { huile: { upsert: { create: stripRelationMeta(huile), update: stripRelationMeta(huile) } } }),
        ...(vibrations && { vibrations: { upsert: { create: stripRelationMeta(vibrations), update: stripRelationMeta(vibrations) } } }),
        ...(echappementCalc && { echappement: { upsert: { create: stripRelationMeta(echappementCalc), update: stripRelationMeta(echappementCalc) } } }),
        ...(metal_blanc && { metal_blanc: { upsert: { create: stripRelationMeta(metal_blanc), update: stripRelationMeta(metal_blanc) } } }),
      },
      include: { generateur: true, huile: true, vibrations: true, echappement: true, metal_blanc: true },
    });
    res.json(releve);
  } catch (err: any) {
    console.error('[PUT /bloc/:id]', err);
    res.status(500).json({ error: err.message ?? 'Erreur serveur' });
  }
});

router.delete('/bloc/:id', async (req, res) => {
  try {
    await prisma.relevesChefBloc.delete({ where: { id: req.params.id } });
    res.json({ message: 'Relevé supprimé' });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Permet au chef de quart (ou à un rôle supérieur) de rouvrir temporairement un
// créneau déjà saisi, le temps d'une correction par le chef de bloc. Le créneau se
// reverrouille automatiquement à la prochaine sauvegarde (PUT /bloc/:id).
router.post('/bloc/:id/deverrouiller', requireRole('chef_quart', 'chef_exploitation', 'admin'), async (req, res) => {
  try {
    const releve = await prisma.relevesChefBloc.update({
      where: { id: req.params.id },
      data: { deverrouille: true },
    });
    res.json(releve);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ===== VUE COMBINÉE DU JOUR =====

router.get('/jour/:date', async (req, res) => {
  try {
    const jourDate = new Date(`${req.params.date}T00:00:00.000Z`);

    const journee = await prisma.journee.findUnique({ where: { jour: jourDate } });
    if (!journee) return res.json({ bloc: [], operateur: [] });

    const [bloc, operateur] = await Promise.all([
      prisma.relevesChefBloc.findMany({
        where: { journee_id: journee.id },
        include: {
          saiseur: { select: { nom: true, prenom: true, matricule: true } },
          generateur: true,
          echappement: true,
          vibrations: true,
          huile: true,
          metal_blanc: true,
        },
        orderBy: { heure_releve: 'asc' },
      }),
      prisma.relevesOperateur.findMany({
        where: { journee_id: journee.id },
        include: { saiseur: { select: { nom: true, prenom: true, matricule: true } } },
        orderBy: { heure_releve: 'asc' },
      }),
    ]);

    res.json({ bloc, operateur });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Relevés bruts sur une plage date/heure libre, pour tracer la courbe d'un
// paramètre précis depuis la page Visualisation (indépendamment des metricId
// figés utilisés par /serie, qui ne couvrent qu'un sous-ensemble des champs).
router.get('/plage', async (req, res) => {
  try {
    const { source, from, to } = req.query;
    if (source !== 'bloc' && source !== 'operateur') {
      return res.status(400).json({ error: 'Paramètre source invalide (bloc|operateur)' });
    }
    if (!from || !to || typeof from !== 'string' || typeof to !== 'string') {
      return res.status(400).json({ error: 'Paramètres from/to requis (ISO datetime)' });
    }
    const where = { heure_releve: { gte: new Date(from), lte: new Date(to) } };

    const rows = source === 'bloc'
      ? await prisma.relevesChefBloc.findMany({
          where,
          include: { generateur: true, echappement: true, vibrations: true, huile: true, metal_blanc: true },
          orderBy: { heure_releve: 'asc' },
        })
      : await prisma.relevesOperateur.findMany({ where, orderBy: { heure_releve: 'asc' } });

    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ===== RELEVES OPERATEUR =====

router.get('/operateur/journee/:journeeId', async (req, res) => {
  try {
    const releves = await prisma.relevesOperateur.findMany({
      where: { journee_id: req.params.journeeId },
      include: { saiseur: { select: { nom: true, prenom: true, matricule: true } } },
      orderBy: { heure_releve: 'asc' },
    });
    res.json(releves);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/operateur/:id', async (req, res) => {
  try {
    const releve = await prisma.relevesOperateur.findUnique({
      where: { id: req.params.id },
      include: { saiseur: { select: { nom: true, prenom: true, matricule: true } } },
    });
    if (!releve) return res.status(404).json({ error: 'Relevé non trouvé' });
    res.json(releve);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/operateur', async (req, res) => {
  try {
    const { journee_id, poste_id, heure_releve, ...rest } = req.body;
    const releve = await prisma.relevesOperateur.create({
      data: {
        ...rest,
        journee_id,
        poste_id,
        saisi_par: req.user!.userId,
        heure_releve: new Date(heure_releve),
      },
    });
    res.status(201).json(releve);
  } catch (err: any) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Un relevé existe déjà pour cette heure' });
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.put('/operateur/:id', async (req, res) => {
  try {
    // Strip non-updatable fields and Prisma relation objects sent by the frontend
    const { id, journee_id, cree_le, synced, deverrouille, saiseur, journee, poste, heure_releve, ...rest } = req.body;
    const releve = await prisma.relevesOperateur.update({
      where: { id: req.params.id },
      data: {
        ...rest,
        saisi_par: req.user!.userId,
        heure_releve: new Date(heure_releve),
        deverrouille: false,
      },
      include: { saiseur: { select: { nom: true, prenom: true, matricule: true } } },
    });
    res.json(releve);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.delete('/operateur/:id', async (req, res) => {
  try {
    await prisma.relevesOperateur.delete({ where: { id: req.params.id } });
    res.json({ message: 'Relevé supprimé' });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Voir le commentaire équivalent sur /bloc/:id/deverrouiller.
router.post('/operateur/:id/deverrouiller', requireRole('chef_quart', 'chef_exploitation', 'admin'), async (req, res) => {
  try {
    const releve = await prisma.relevesOperateur.update({
      where: { id: req.params.id },
      data: { deverrouille: true },
    });
    res.json(releve);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ===== ANALYSE & DIAGNOSTIC (courbes) =====

// Catalogue fermé des mesures exposées à la page d'analyse : la clé publique (envoyée
// par le frontend) est mappée ici vers l'extraction réelle de la valeur, pour ne jamais
// laisser le client piloter directement une requête Prisma.
type MetricSource = 'bloc' | 'operateur';
const METRICS: Record<string, { source: MetricSource; get: (r: any) => number | null | undefined }> = {
  // Chef de bloc
  bloc_puissance_active: { source: 'bloc', get: (r) => r.generateur?.puissance_active_mw },
  bloc_puissance_reactive: { source: 'bloc', get: (r) => r.generateur?.puissance_reactive_mvar },
  bloc_frequence: { source: 'bloc', get: (r) => r.generateur?.frequence_hz },
  bloc_cos_phi: { source: 'bloc', get: (r) => r.generateur?.cos_phi },
  bloc_tension_alternateur: { source: 'bloc', get: (r) => r.generateur?.tension_alt_dvx_kv },
  bloc_tension_ligne: { source: 'bloc', get: (r) => r.generateur?.tension_svlx_kv },
  bloc_temp_echappement: { source: 'bloc', get: (r) => r.echappement?.ttxm_moyenne },
  bloc_spread: { source: 'bloc', get: (r) => r.echappement?.spread_calcule },
  bloc_ecart_ttxspl: { source: 'bloc', get: (r) => r.echappement?.ttxspl_ecart },
  bloc_vibration_maxi: { source: 'bloc', get: (r) => r.vibrations?.vibration_maxi },
  bloc_temp_ambiante: { source: 'bloc', get: (r) => r.temp_ambiante_ctim },
  bloc_pression_atm: { source: 'bloc', get: (r) => r.pression_atm_afpap },
  bloc_vitesse_turbine: { source: 'bloc', get: (r) => r.vitesse_turbine_rpm },
  bloc_niveau_huile: { source: 'bloc', get: (r) => r.huile?.niveau_bac_huile_mm },
  bloc_temp_huile_collecteur: { source: 'bloc', get: (r) => r.huile?.temp_collecteur_ltth },
  // Opérateur
  op_pression_refoul_pompe: { source: 'operateur', get: (r) => r.pression_refoul_pompe_bar },
  op_temp_entree_ref: { source: 'operateur', get: (r) => r.temp_entree_ref_wtad1 },
  op_temp_sortie_ref: { source: 'operateur', get: (r) => r.temp_sortie_ref_wtad2 },
  op_pression_retour_eau_ref: { source: 'operateur', get: (r) => r.pression_retour_eau_ref },
  op_niveau_reservoir_expansion: { source: 'operateur', get: (r) => r.niveau_reservoir_expansion },
  op_temp_gaz: { source: 'operateur', get: (r) => r.temp_gaz_ftg_tkg },
  op_pression_gaz: { source: 'operateur', get: (r) => r.pression_gaz_fpgi_bar },
  op_niveau_huile_reservoir: { source: 'operateur', get: (r) => r.niveau_huile_reservoir },
  op_pression_air_atomisation: { source: 'operateur', get: (r) => r.pression_air_atomisation },
  op_pression_air_comprime: { source: 'operateur', get: (r) => r.pression_air_comprime_bar },
  op_temp_huile_tp: { source: 'operateur', get: (r) => r.temp_huile_tp },
  op_temp_enroulement_tp: { source: 'operateur', get: (r) => r.temp_enroulement_tp },
  op_temp_huile_ts: { source: 'operateur', get: (r) => r.temp_huile_ts },
  op_temp_enroulement_ts: { source: 'operateur', get: (r) => r.temp_enroulement_ts },
  op_pression_circuit_incendie: { source: 'operateur', get: (r) => r.pression_circuit_incendie },
  op_niveau_gasoil_ppe: { source: 'operateur', get: (r) => r.niveau_gasoil_ppe_pct },
  op_stock_gasoil: { source: 'operateur', get: (r) => r.stock_gasoil_l },
  op_temp_eau_primaire: { source: 'operateur', get: (r) => r.temp_eau_primaire_ge },
  op_temp_eau_secondaire: { source: 'operateur', get: (r) => r.temp_eau_secondaire_ge },
  op_pression_air_demarrage: { source: 'operateur', get: (r) => r.pression_air_demarrage_ge },
  op_nb_heures_marche: { source: 'operateur', get: (r) => r.nb_heures_marche_ge },
};

router.get('/serie/:metricId', requireRole('chef_quart', 'chef_exploitation', 'directeur', 'admin'), async (req, res) => {
  try {
    const metric = METRICS[req.params.metricId];
    if (!metric) return res.status(400).json({ error: 'Mesure inconnue' });

    const { from, to } = req.query;
    if (!from || !to || typeof from !== 'string' || typeof to !== 'string') {
      return res.status(400).json({ error: 'Paramètres from/to requis (yyyy-MM-dd)' });
    }
    const where = { heure_releve: { gte: new Date(`${from}T00:00:00.000Z`), lte: new Date(`${to}T23:59:59.999Z`) } };

    const rows = metric.source === 'bloc'
      ? await prisma.relevesChefBloc.findMany({
          where,
          include: { generateur: true, huile: true, vibrations: true, echappement: true },
          orderBy: { heure_releve: 'asc' },
        })
      : await prisma.relevesOperateur.findMany({ where, orderBy: { heure_releve: 'asc' } });

    const serie = rows
      .map((r) => ({ heure_releve: r.heure_releve, value: metric.get(r) }))
      .filter((p) => p.value !== null && p.value !== undefined);

    res.json(serie);
  } catch (err: any) {
    console.error('[GET /releves/serie]', err);
    res.status(500).json({ error: err.message ?? 'Erreur serveur' });
  }
});

// ===== COMPTEURS JOURNALIERS =====

// Chaque compteur cumulatif est relevé à des heures fixes dans la journée ; la valeur
// ne doit jamais reculer d'un relevé au suivant (un compteur ne fait qu'avancer).
const COUNTER_SEQUENCES: string[][] = [
  ['energie_active_00h', 'energie_active_07h', 'energie_active_18h', 'energie_active_22h', 'energie_active_24h'],
  ['reactif_fourni_00h', 'reactif_fourni_07h', 'reactif_fourni_18h', 'reactif_fourni_22h', 'reactif_fourni_24h'],
  ['reactif_absorbe_00h', 'reactif_absorbe_07h', 'reactif_absorbe_18h', 'reactif_absorbe_22h', 'reactif_absorbe_24h'],
  ['auxiliaires_00h', 'auxiliaires_07h', 'auxiliaires_18h', 'auxiliaires_22h', 'auxiliaires_24h'],
  ['gasoil_00h_l', 'gasoil_07h_l', 'gasoil_18h_l', 'gasoil_22h_l', 'gasoil_24h_l'],
  ['gaz_00h_nm3', 'gaz_24h_nm3'],
  ['h_flamme_00h', 'h_flamme_24h'],
  ['h_pms_00h', 'h_pms_24h'],
  ['h_gaz_00h', 'h_gaz_24h'],
  ['h_gasoil_00h', 'h_gasoil_24h'],
  ['dem_manuel_00h', 'dem_manuel_24h'],
  ['dem_total_00h', 'dem_total_24h'],
  ['dem_rapide_00h', 'dem_rapide_24h'],
  ['allumage_00h', 'allumage_24h'],
  ['declenchement_00h', 'declenchement_24h'],
];

// [champ 24h du jour, champ 00h du lendemain] — sert au report automatique et à la
// vérification de continuité (le 00h du jour ne doit pas reculer par rapport au 24h de la veille).
const CARRY: [string, string][] = COUNTER_SEQUENCES.map(seq => [seq[seq.length - 1], seq[0]]);

function toNum(v: any): number {
  return typeof v === 'object' && v !== null && typeof v.toString === 'function' ? Number(v.toString()) : Number(v);
}

/** Retourne un message d'erreur pour le premier recul détecté parmi les champs touchés par cette saisie, sinon null. */
function findCounterRegression(merged: Record<string, any>, touchedFields: Set<string>): string | null {
  for (const seq of COUNTER_SEQUENCES) {
    let prevField: string | null = null;
    let prevVal: number | null = null;
    for (const field of seq) {
      const raw = merged[field];
      if (raw == null) continue;
      const val = toNum(raw);
      if (prevVal != null && val < prevVal && (touchedFields.has(field) || (prevField && touchedFields.has(prevField)))) {
        return `Le compteur "${field}" (${val}) ne peut pas être inférieur à "${prevField}" (${prevVal}) : un compteur ne peut pas reculer.`;
      }
      prevVal = val;
      prevField = field;
    }
  }
  return null;
}

/**
 * conso_aux_cycles : liste de cycles { couplage, decouplage } (plusieurs démarrages/arrêts
 * possibles dans la journée). Comme c'est le même compteur cumulatif, la séquence aplatie
 * couplage1, decouplage1, couplage2, decouplage2, ... ne doit jamais reculer non plus.
 */
function findConsoAuxCyclesRegression(cycles: any): string | null {
  if (!Array.isArray(cycles)) return null;
  let prevVal: number | null = null;
  let prevLabel = '';
  for (let i = 0; i < cycles.length; i++) {
    const c = cycles[i] || {};
    for (const [key, label] of [['couplage', `couplage ${i + 1}`], ['decouplage', `découplage ${i + 1}`]] as const) {
      const raw = c[key];
      if (raw == null) continue;
      const val = toNum(raw);
      if (prevVal != null && val < prevVal) {
        return `Le compteur "${label}" (${val}) ne peut pas être inférieur à "${prevLabel}" (${prevVal}) : un compteur ne peut pas reculer.`;
      }
      prevVal = val;
      prevLabel = label;
    }
  }
  return null;
}

router.get('/compteurs/:journeeId', async (req, res) => {
  try {
    const compteurs = await prisma.compteursJournaliers.findUnique({
      where: { journee_id: req.params.journeeId },
    });
    res.json(compteurs);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/compteurs', async (req, res) => {
  try {
    const { journee_id, ...data } = req.body;
    const touchedFields = new Set(Object.keys(data));

    const existing = await prisma.compteursJournaliers.findUnique({ where: { journee_id } });
    const merged = { ...(existing || {}), ...data };

    const regression = findCounterRegression(merged, touchedFields) || findConsoAuxCyclesRegression(data.conso_aux_cycles);
    if (regression) {
      return res.status(400).json({ error: regression });
    }

    const journee = await prisma.journee.findUnique({ where: { id: journee_id } });

    // Continuité avec la veille : le 00h du jour ne doit pas être inférieur au 24h précédent.
    if (journee) {
      const prevDay = new Date(journee.jour);
      prevDay.setUTCDate(prevDay.getUTCDate() - 1);
      const prevJournee = await prisma.journee.findUnique({ where: { jour: prevDay } });
      if (prevJournee) {
        const prevCompteurs = await prisma.compteursJournaliers.findUnique({ where: { journee_id: prevJournee.id } });
        if (prevCompteurs) {
          for (const [from24h, to00h] of CARRY) {
            if (!touchedFields.has(to00h)) continue;
            const prevVal = (prevCompteurs as any)[from24h];
            const curVal = merged[to00h];
            if (prevVal != null && curVal != null && toNum(curVal) < toNum(prevVal)) {
              return res.status(400).json({
                error: `Le compteur "${to00h}" (${toNum(curVal)}) ne peut pas être inférieur au "${from24h}" de la veille (${toNum(prevVal)}).`,
              });
            }
          }
        }
      }
    }

    const compteurs = await prisma.compteursJournaliers.upsert({
      where: { journee_id },
      create: { journee_id, ...data },
      update: data,
    });

    // Reporter les valeurs 24h → 00h de la journée suivante
    if (journee) {
      const nextDay = new Date(journee.jour);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      const nextJournee = await prisma.journee.findUnique({ where: { jour: nextDay } });
      if (nextJournee) {
        const carry: Record<string, any> = {};
        for (const [from, to] of CARRY) {
          if (data[from] != null) carry[to] = data[from];
        }
        if (Object.keys(carry).length > 0) {
          await prisma.compteursJournaliers.upsert({
            where: { journee_id: nextJournee.id },
            create: { journee_id: nextJournee.id, ...carry },
            update: carry,
          });
        }
      }
    }

    res.json(compteurs);
  } catch (err: any) {
    console.error('[POST /compteurs]', err);
    res.status(500).json({ error: err.message ?? 'Erreur serveur' });
  }
});

export default router;
