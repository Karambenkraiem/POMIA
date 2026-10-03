import { Router } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();
router.use(authenticate);

const INTERVALLE_JOURS: Record<string, number> = {
  journalier: 1,
  hebdomadaire: 7,
  mensuelle: 30,
  semestrielle: 182,
  annuelle: 365,
};

function toUtcMidnight(d: Date) {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Crée les instances des essais dus pour cette journée (appelé à la création de la journée). */
export async function triggerDueEssais(journeeId: string, jourDate: Date) {
  const configs = await prisma.essaiConfig.findMany({ where: { actif: true } });
  const jourMidnight = toUtcMidnight(jourDate);

  for (const c of configs) {
    if (c.frequence === 'hebdomadaire' && c.jours_semaine.length > 0) {
      // Jours choisis (0=dimanche … 6=samedi), plutôt qu'un intervalle de 7 jours glissant.
      if (!c.jours_semaine.includes(jourDate.getUTCDay())) continue;
    } else if (c.frequence !== 'journalier') {
      const reference = c.derniere_execution ?? c.cree_le;
      const refMidnight = toUtcMidnight(new Date(reference));
      const joursEcoules = Math.round((jourMidnight - refMidnight) / 86400000);
      if (joursEcoules < INTERVALLE_JOURS[c.frequence]) continue;
    }
    await prisma.essaiInstance.upsert({
      where: { essai_id_journee_id: { essai_id: c.id, journee_id: journeeId } },
      create: { essai_id: c.id, journee_id: journeeId },
      update: {},
    }).catch(() => {});
  }
}

/** Rattrapage : si la journée du jour existe déjà, vérifie si cet essai y est dû
 *  (sinon il faudrait attendre la création de la journée suivante pour le voir apparaître). */
async function triggerForTodayIfJourneeExists() {
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const today = new Date(todayStr + 'T00:00:00.000Z');
  const journee = await prisma.journee.findUnique({ where: { jour: today } });
  if (journee) await triggerDueEssais(journee.id, today);
}

// ===== Paramétrage des essais (chef d'exploitation / admin) =====

router.get('/', async (_req, res) => {
  try {
    const essais = await prisma.essaiConfig.findMany({
      include: { releves: { orderBy: { ordre: 'asc' } } },
      orderBy: { nom: 'asc' },
    });
    res.json(essais);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/', requireRole('chef_exploitation', 'admin'), async (req, res) => {
  try {
    const { nom, frequence, actif, releves, jours_semaine } = req.body;
    if (!nom || !frequence) return res.status(400).json({ error: 'Nom et fréquence requis' });
    const essai = await prisma.essaiConfig.create({
      data: {
        nom,
        frequence,
        actif: actif ?? true,
        jours_semaine: frequence === 'hebdomadaire' ? (jours_semaine || []) : [],
        releves: {
          create: (releves || []).map((r: any, i: number) => ({
            nom: r.nom,
            type: r.type,
            unite: r.unite || null,
            options: r.type === 'selection' ? (r.options || []) : undefined,
            ordre: i,
          })),
        },
      },
      include: { releves: { orderBy: { ordre: 'asc' } } },
    });
    if (essai.actif) await triggerForTodayIfJourneeExists().catch(() => {});
    res.status(201).json(essai);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.put('/:id', requireRole('chef_exploitation', 'admin'), async (req, res) => {
  try {
    const { nom, frequence, actif, releves, jours_semaine } = req.body;
    const essai = await prisma.$transaction(async (tx) => {
      await tx.essaiConfig.update({
        where: { id: req.params.id },
        data: {
          nom,
          frequence,
          actif,
          jours_semaine: frequence === 'hebdomadaire' ? (jours_semaine || []) : [],
          modifie_le: new Date(),
        },
      });
      if (Array.isArray(releves)) {
        await tx.essaiReleveConfig.deleteMany({ where: { essai_id: req.params.id } });
        for (let i = 0; i < releves.length; i++) {
          const r = releves[i];
          await tx.essaiReleveConfig.create({
            data: {
              essai_id: req.params.id,
              nom: r.nom,
              type: r.type,
              unite: r.unite || null,
              options: r.type === 'selection' ? (r.options || []) : undefined,
              ordre: i,
            },
          });
        }
      }
      return tx.essaiConfig.findUnique({
        where: { id: req.params.id },
        include: { releves: { orderBy: { ordre: 'asc' } } },
      });
    });
    if (essai?.actif) await triggerForTodayIfJourneeExists().catch(() => {});
    res.json(essai);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.delete('/:id', requireRole('chef_exploitation', 'admin'), async (req, res) => {
  try {
    await prisma.essaiConfig.delete({ where: { id: req.params.id } });
    res.json({ message: 'Essai supprimé' });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ===== Exécution des essais (journalier) =====

/** Dates (yyyy-MM-dd) ayant au moins un essai — pour marquer le calendrier. */
router.get('/dates', async (_req, res) => {
  try {
    const instances = await prisma.essaiInstance.findMany({
      select: { journee: { select: { jour: true } } },
      distinct: ['journee_id'],
    });
    const dates = instances.map((i) => {
      const d = i.journee.jour;
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    });
    res.json([...new Set(dates)]);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/journee/:journeeId', async (req, res) => {
  try {
    const instances = await prisma.essaiInstance.findMany({
      where: { journee_id: req.params.journeeId },
      include: {
        essai: { include: { releves: { orderBy: { ordre: 'asc' } } } },
        executant: { select: { nom: true, prenom: true } },
      },
      orderBy: { cree_le: 'asc' },
    });
    res.json(instances);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.put('/instance/:id', async (req, res) => {
  try {
    const { statut, valeurs, motif_annulation } = req.body;
    const role = req.user!.role;

    const instance = await prisma.essaiInstance.findUnique({ where: { id: req.params.id }, include: { journee: true } });
    if (!instance) return res.status(404).json({ error: 'Introuvable' });

    // Un essai validé est verrouillé : il faut l'accord du chef d'exploitation (déverrouillage) pour le corriger.
    if (instance.statut === 'effectue' && !instance.deverrouille) {
      return res.status(403).json({ error: "Essai déjà validé et verrouillé — demandez le déverrouillage au chef d'exploitation" });
    }

    if (statut === 'annule' && !['chef_quart', 'admin'].includes(role)) {
      return res.status(403).json({ error: 'Seul le chef de quart peut annuler un essai' });
    }
    if (statut === 'annule' && !motif_annulation?.trim()) {
      return res.status(400).json({ error: 'Le motif d\'annulation est requis' });
    }
    if (!['operateur', 'chef_bloc', 'chef_quart', 'chef_exploitation', 'admin'].includes(role)) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const data: any = {};
    if (valeurs !== undefined) data.valeurs = valeurs;
    if (statut) {
      data.statut = statut;
      if (statut === 'effectue') {
        data.effectue_par = req.user!.userId;
        data.effectue_le = new Date();
        data.motif_annulation = null;
        data.deverrouille = false; // reverrouille automatiquement à la validation
      } else if (statut === 'annule') {
        data.motif_annulation = motif_annulation.trim();
        data.effectue_par = req.user!.userId;
        data.effectue_le = new Date();
      } else {
        data.motif_annulation = null;
        data.effectue_par = null;
        data.effectue_le = null;
      }
    }

    const updated = await prisma.essaiInstance.update({
      where: { id: req.params.id },
      data,
      include: { essai: { include: { releves: { orderBy: { ordre: 'asc' } } } }, executant: { select: { nom: true, prenom: true } } },
    });

    if (statut === 'effectue') {
      await prisma.essaiConfig.update({
        where: { id: instance.essai_id },
        data: { derniere_execution: instance.journee.jour },
      });
    }

    res.json(updated);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Voir le commentaire équivalent sur /releves/{bloc,operateur}/:id/deverrouiller.
router.post('/instance/:id/deverrouiller', requireRole('chef_exploitation', 'admin'), async (req, res) => {
  try {
    const updated = await prisma.essaiInstance.update({
      where: { id: req.params.id },
      data: { deverrouille: true },
      include: { essai: { include: { releves: { orderBy: { ordre: 'asc' } } } }, executant: { select: { nom: true, prenom: true } } },
    });
    res.json(updated);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ===== Historique par essai (classé par nom d'essai) =====

router.get('/:essaiId/instances', async (req, res) => {
  try {
    const instances = await prisma.essaiInstance.findMany({
      where: { essai_id: req.params.essaiId },
      include: {
        essai: { include: { releves: { orderBy: { ordre: 'asc' } } } },
        journee: { select: { jour: true } },
        executant: { select: { nom: true, prenom: true } },
      },
      orderBy: { journee: { jour: 'desc' } },
    });
    res.json(instances);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/:essaiId/instances/:instanceId', async (req, res) => {
  try {
    const instance = await prisma.essaiInstance.findUnique({
      where: { id: req.params.instanceId },
      include: {
        essai: { include: { releves: { orderBy: { ordre: 'asc' } } } },
        journee: { select: { jour: true } },
        executant: { select: { nom: true, prenom: true } },
      },
    });
    if (!instance) return res.status(404).json({ error: 'Introuvable' });
    res.json(instance);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
