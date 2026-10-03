import { Router } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();
const VIEW_ROLES = ['operateur', 'chef_bloc', 'chef_quart', 'chef_exploitation', 'chef_centrale', 'admin'];
const EDIT_ROLES = ['chef_exploitation', 'chef_quart', 'admin'];

router.use(authenticate);

router.get('/', requireRole(...VIEW_ROLES), async (_req, res) => {
  try {
    const consignes = await prisma.consigne.findMany({
      include: { auteur: { select: { nom: true, prenom: true } } },
      orderBy: { date: 'desc' },
    });
    res.json(consignes);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/', requireRole(...EDIT_ROLES), async (req, res) => {
  try {
    const { texte } = req.body;
    if (!texte?.trim()) return res.status(400).json({ error: 'Texte requis' });
    const consigne = await prisma.consigne.create({
      data: { texte: texte.trim(), cree_par: req.user!.userId },
      include: { auteur: { select: { nom: true, prenom: true } } },
    });
    res.status(201).json(consigne);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.put('/:id', requireRole(...EDIT_ROLES), async (req, res) => {
  try {
    const { texte, terminee } = req.body;
    const consigne = await prisma.consigne.update({
      where: { id: req.params.id },
      data: {
        ...(texte !== undefined && { texte: String(texte).trim() }),
        ...(terminee !== undefined && { terminee }),
        modifie_le: new Date(),
      },
      include: { auteur: { select: { nom: true, prenom: true } } },
    });
    res.json(consigne);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Relance une consigne terminée : nouvelle date de déclenchement, remonte en tête de liste.
router.post('/:id/relancer', requireRole(...EDIT_ROLES), async (req, res) => {
  try {
    const consigne = await prisma.consigne.update({
      where: { id: req.params.id },
      data: { terminee: false, date: new Date(), modifie_le: new Date() },
      include: { auteur: { select: { nom: true, prenom: true } } },
    });
    res.json(consigne);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.delete('/:id', requireRole(...EDIT_ROLES), async (req, res) => {
  try {
    await prisma.consigne.delete({ where: { id: req.params.id } });
    res.json({ message: 'Consigne supprimée' });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
