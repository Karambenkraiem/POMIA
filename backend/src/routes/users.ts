import { Router } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const users = await prisma.utilisateur.findMany({
      select: { id: true, nom: true, prenom: true, matricule: true, role: true, actif: true, cree_le: true },
      orderBy: { nom: 'asc' },
    });
    res.json(users);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const { nom, prenom, matricule, role, password } = req.body;
    if (!nom || !prenom || !matricule || !role || !password) {
      return res.status(400).json({ error: 'Tous les champs sont requis' });
    }
    const hash = await bcrypt.hash(password, 10);
    const user = await prisma.utilisateur.create({
      data: { nom, prenom, matricule, role, mot_de_passe_hash: hash },
      select: { id: true, nom: true, prenom: true, matricule: true, role: true, actif: true },
    });
    res.status(201).json(user);
  } catch (err: any) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Matricule déjà utilisé' });
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.put('/:id', requireRole('admin'), async (req, res) => {
  try {
    const { nom, prenom, role, actif, password } = req.body;
    const data: any = { nom, prenom, role, actif, modifie_le: new Date() };
    if (password) data.mot_de_passe_hash = await bcrypt.hash(password, 10);
    const user = await prisma.utilisateur.update({
      where: { id: req.params.id },
      data,
      select: { id: true, nom: true, prenom: true, matricule: true, role: true, actif: true },
    });
    res.json(user);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    if (req.params.id === req.user!.userId) {
      return res.status(400).json({ error: 'Impossible de supprimer son propre compte' });
    }
    await prisma.utilisateur.update({
      where: { id: req.params.id },
      data: { actif: false },
    });
    res.json({ message: 'Utilisateur désactivé' });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
