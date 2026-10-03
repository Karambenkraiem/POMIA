import { Router } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { actif, zone } = req.query;
    const where: any = {};
    if (actif === 'true') where.date_cloture = null;
    if (actif === 'false') where.date_cloture = { not: null };
    if (zone) where.zone = zone;
    const defauts = await prisma.materielDefectueux.findMany({
      where,
      orderBy: { date_declaration: 'desc' },
      include: {
        commentaireAuteur: { select: { nom: true, prenom: true } },
      },
    });
    res.json(defauts);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { kks_equipement, description, zone, date_declaration, commentaires } = req.body;
    const defaut = await prisma.materielDefectueux.create({
      data: {
        kks_equipement,
        description,
        zone,
        date_declaration: new Date(date_declaration),
        commentaires,
        statut: 'ouvert',
        ...(commentaires ? { commentaire_par: req.user!.userId, commentaire_le: new Date() } : {}),
      },
    });
    res.status(201).json(defaut);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { kks_equipement, description, zone, commentaires, statut, date_cloture } = req.body;
    const prev = await prisma.materielDefectueux.findUnique({ where: { id: req.params.id } });
    const commentaireChanged = (commentaires ?? null) !== (prev?.commentaires ?? null);
    const defaut = await prisma.materielDefectueux.update({
      where: { id: req.params.id },
      data: {
        kks_equipement,
        description,
        zone,
        commentaires,
        statut,
        date_cloture: date_cloture ? new Date(date_cloture) : undefined,
        modifie_le: new Date(),
        ...(commentaireChanged ? { commentaire_par: req.user!.userId, commentaire_le: new Date() } : {}),
      },
      include: {
        commentaireAuteur: { select: { nom: true, prenom: true } },
      },
    });
    res.json(defaut);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/:id/cloturer', requireRole('chef_bloc', 'chef_quart', 'chef_exploitation', 'admin'), async (req, res) => {
  try {
    const defaut = await prisma.materielDefectueux.update({
      where: { id: req.params.id },
      data: { statut: 'cloture', date_cloture: new Date(), modifie_le: new Date() },
    });
    res.json(defaut);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Seuils d'alarme
router.get('/seuils', async (req, res) => {
  try {
    const seuils = await prisma.seuilAlarme.findMany({ orderBy: { parametre: 'asc' } });
    res.json(seuils);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.put('/seuils/:id', requireRole('admin'), async (req, res) => {
  try {
    const { valeur_min, valeur_max, actif } = req.body;
    const seuil = await prisma.seuilAlarme.update({
      where: { id: req.params.id },
      data: { valeur_min, valeur_max, actif, modifie_par: req.user!.userId, modifie_le: new Date() },
    });
    res.json(seuil);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
