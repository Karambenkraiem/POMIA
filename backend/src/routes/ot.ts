import { Router } from 'express';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/journee/:journeeId', async (req, res) => {
  try {
    const ots = await prisma.ordreTravaux.findMany({
      where: { journee_id: req.params.journeeId },
      orderBy: { cree_le: 'desc' },
    });
    res.json(ots);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/', async (req, res) => {
  try {
    const ots = await prisma.ordreTravaux.findMany({
      include: { journee: { select: { jour: true } } },
      orderBy: { cree_le: 'desc' },
      take: 100,
    });
    res.json(ots);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { journee_id, numero_ot, kks_equipement, description, date_debut, date_fin, etat, discipline, type_maintenance } = req.body;
    const ot = await prisma.ordreTravaux.create({
      data: {
        journee_id,
        numero_ot,
        kks_equipement,
        description,
        date_debut: date_debut ? new Date(date_debut) : undefined,
        date_fin: date_fin ? new Date(date_fin) : undefined,
        etat: etat || 'en_cours',
        discipline,
        type_maintenance,
      },
    });
    res.status(201).json(ot);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { numero_ot, kks_equipement, description, date_debut, date_fin, etat, discipline, type_maintenance } = req.body;
    const ot = await prisma.ordreTravaux.update({
      where: { id: req.params.id },
      data: {
        numero_ot,
        kks_equipement,
        description,
        date_debut: date_debut ? new Date(date_debut) : undefined,
        date_fin: date_fin ? new Date(date_fin) : undefined,
        etat,
        discipline,
        type_maintenance,
      },
    });
    res.json(ot);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await prisma.ordreTravaux.delete({ where: { id: req.params.id } });
    res.json({ message: 'OT supprimé' });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Demandes de service
router.get('/ds/journee/:journeeId', async (req, res) => {
  try {
    const ds = await prisma.demandeService.findMany({
      where: { journee_id: req.params.journeeId },
      orderBy: { cree_le: 'desc' },
    });
    res.json(ds);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/ds', async (req, res) => {
  try {
    const { journee_id, numero_ds, urgence, description } = req.body;
    const ds = await prisma.demandeService.create({
      data: { journee_id, numero_ds, urgence, description },
    });
    res.status(201).json(ds);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.delete('/ds/:id', async (req, res) => {
  try {
    await prisma.demandeService.delete({ where: { id: req.params.id } });
    res.json({ message: 'DS supprimée' });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
