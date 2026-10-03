import { Router } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/auth';
import { triggerDueEssais } from './essais';

const router = Router();
router.use(authenticate);

const CARRY_MAP: [string, string][] = [
  ['energie_active_24h',  'energie_active_00h'],
  ['reactif_fourni_24h',  'reactif_fourni_00h'],
  ['reactif_absorbe_24h', 'reactif_absorbe_00h'],
  ['auxiliaires_24h',     'auxiliaires_00h'],
  ['gaz_24h_nm3',         'gaz_00h_nm3'],
  ['gasoil_24h_l',        'gasoil_00h_l'],
  ['h_flamme_24h',        'h_flamme_00h'],
  ['h_pms_24h',           'h_pms_00h'],
  ['h_gaz_24h',           'h_gaz_00h'],
  ['h_gasoil_24h',        'h_gasoil_00h'],
  ['dem_manuel_24h',      'dem_manuel_00h'],
  ['dem_total_24h',       'dem_total_00h'],
  ['dem_rapide_24h',      'dem_rapide_00h'],
  ['allumage_24h',        'allumage_00h'],
  ['declenchement_24h',   'declenchement_00h'],
];

async function carryPreviousCompteurs(journeeId: string, jourDate: Date) {
  const prevDay = new Date(jourDate);
  prevDay.setUTCDate(prevDay.getUTCDate() - 1);
  const prevJournee = await prisma.journee.findUnique({
    where: { jour: prevDay },
    include: { compteurs: true },
  });
  if (!prevJournee?.compteurs) return;
  const prev = prevJournee.compteurs as any;
  const carry: Record<string, any> = {};
  for (const [from, to] of CARRY_MAP) {
    if (prev[from] != null) carry[to] = prev[from];
  }
  if (Object.keys(carry).length > 0) {
    await prisma.compteursJournaliers.create({
      data: { journee_id: journeeId, ...carry },
    });
  }
}

async function carryPreviousAlarmes(journeeId: string, jourDate: Date) {
  const prevDay = new Date(jourDate);
  prevDay.setUTCDate(prevDay.getUTCDate() - 1);
  const prevJournee = await prisma.journee.findUnique({
    where: { jour: prevDay },
    include: { alarmes: { where: { repetitive: true } } },
  });
  if (!prevJournee?.alarmes?.length) return;
  await prisma.alarme.createMany({
    data: prevJournee.alarmes.map(a => ({
      journee_id: journeeId,
      tag: a.tag,
      designation: a.designation,
      heure: a.heure,
      origine: a.origine,
      repetitive: true,
    })),
  });
}

router.get('/', async (req, res) => {
  try {
    const { from, to } = req.query;
    const where: any = {};
    if (from || to) {
      where.jour = {};
      if (from) where.jour.gte = new Date(from as string);
      if (to) where.jour.lte = new Date(to as string);
    }
    const journees = await prisma.journee.findMany({
      where,
      orderBy: { jour: 'desc' },
      include: {
        postes: { include: { chefQuart: { select: { nom: true, prenom: true } } } },
        _count: { select: { releves_bloc: true, manouvres: true, alarmes: true, ordres_travaux: true } },
      },
    });

    const incidentCounts = await prisma.manouvre.groupBy({
      by: ['journee_id'],
      where: { type_manouvre: 'incident', journee_id: { in: journees.map((j) => j.id) } },
      _count: { _all: true },
    });
    const incidentsByJournee = new Map(incidentCounts.map((c) => [c.journee_id, c._count._all]));

    res.json(journees.map((j) => ({ ...j, incidents_count: incidentsByJournee.get(j.id) ?? 0 })));
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/today', async (req, res) => {
  try {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    const today = new Date(todayStr + 'T00:00:00.000Z');
    let journee = await prisma.journee.findUnique({
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
        _count: { select: { releves_bloc: true, manouvres: true, alarmes: true, ordres_travaux: true } },
      },
    });
    if (!journee) {
      journee = await prisma.journee.create({
        data: { jour: today },
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
          _count: { select: { releves_bloc: true, manouvres: true, alarmes: true, ordres_travaux: true } },
        },
      });
      await carryPreviousCompteurs(journee.id, today).catch(() => {});
      await carryPreviousAlarmes(journee.id, today).catch(() => {});
      await triggerDueEssais(journee.id, today).catch(() => {});
    }
    res.json(journee);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const journee = await prisma.journee.findUnique({
      where: { id: req.params.id },
      include: {
        postes: {
          include: {
            chefQuart: { select: { id: true, nom: true, prenom: true } },
            chefBloc: { select: { id: true, nom: true, prenom: true } },
            operateur1: { select: { id: true, nom: true, prenom: true } },
            operateur2: { select: { id: true, nom: true, prenom: true } },
          },
        },
        compteurs: true,
        _count: { select: { releves_bloc: true, manouvres: true, alarmes: true, ordres_travaux: true } },
      },
    });
    if (!journee) return res.status(404).json({ error: 'Journée non trouvée' });
    res.json(journee);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { jour, consignes_permanentes } = req.body;
    const jourDate = new Date(jour);
    const journee = await prisma.journee.create({
      data: { jour: jourDate, consignes_permanentes },
    });
    await carryPreviousCompteurs(journee.id, jourDate).catch(() => {});
    await carryPreviousAlarmes(journee.id, jourDate).catch(() => {});
    await triggerDueEssais(journee.id, jourDate).catch(() => {});
    res.status(201).json(journee);
  } catch (err: any) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Journée déjà existante pour cette date' });
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { consignes_permanentes } = req.body;
    const journee = await prisma.journee.update({
      where: { id: req.params.id },
      data: { consignes_permanentes },
    });
    res.json(journee);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/:id/valider-bloc', requireRole('chef_bloc', 'admin'), async (req, res) => {
  try {
    const journee = await prisma.journee.update({
      where: { id: req.params.id },
      data: { statut: 'valide_bloc', valide_bloc_par: req.user!.userId, valide_bloc_le: new Date() },
    });
    res.json(journee);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/:id/valider-quart', requireRole('chef_quart', 'chef_exploitation', 'admin'), async (req, res) => {
  try {
    const journee = await prisma.journee.update({
      where: { id: req.params.id },
      data: { statut: 'valide_quart', valide_quart_par: req.user!.userId, valide_quart_le: new Date() },
    });
    res.json(journee);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/:id/transmettre', requireRole('chef_exploitation', 'admin'), async (req, res) => {
  try {
    const journee = await prisma.journee.update({
      where: { id: req.params.id },
      data: { statut: 'transmis', transmis_le: new Date() },
    });
    res.json(journee);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
