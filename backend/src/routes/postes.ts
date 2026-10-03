import { Router } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/journee/:journeeId', async (req, res) => {
  try {
    const postes = await prisma.poste.findMany({
      where: { journee_id: req.params.journeeId },
      include: {
        chefQuart: { select: { id: true, nom: true, prenom: true } },
        chefBloc: { select: { id: true, nom: true, prenom: true } },
        operateur1: { select: { id: true, nom: true, prenom: true } },
        operateur2: { select: { id: true, nom: true, prenom: true } },
      },
      orderBy: { debut: 'asc' },
    });
    res.json(postes);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { journee_id, tranche, debut, fin, chef_quart_id, chef_bloc_id, operateur1_id, operateur2_id } = req.body;
    const poste = await prisma.poste.create({
      data: { journee_id, tranche, debut: new Date(debut), fin: new Date(fin), chef_quart_id, chef_bloc_id, operateur1_id, operateur2_id },
    });
    res.status(201).json(poste);
  } catch (err: any) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Ce poste existe déjà pour cette journée' });
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.put('/:id', requireRole('chef_quart', 'admin'), async (req, res) => {
  try {
    const { chef_quart_id, chef_bloc_id, operateur1_id, operateur2_id, statut } = req.body;
    const poste = await prisma.poste.update({
      where: { id: req.params.id },
      data: { chef_quart_id, chef_bloc_id, operateur1_id, operateur2_id, statut },
    });
    res.json(poste);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await prisma.poste.delete({ where: { id: req.params.id } });
    res.json({ message: 'Poste supprimé' });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
