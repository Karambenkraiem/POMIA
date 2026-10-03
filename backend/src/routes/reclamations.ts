import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import prisma from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();
const CREATE_ROLES = ['chef_exploitation', 'chef_maintenance', 'chef_centrale', 'md_center_assistant', 'admin'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf';
    if (ok) cb(null, true);
    else cb(new Error('Seules les images et les PDF sont autorisés'));
  },
});

function uploadFichier(req: Request, res: Response, next: NextFunction) {
  upload.single('fichier')(req, res, (err: any) => {
    if (err) return res.status(400).json({ error: err.message || 'Fichier invalide' });
    next();
  });
}

router.use(authenticate);

function notGuest(req: Request, res: Response, next: NextFunction) {
  if (req.user!.role === 'guest') return res.status(403).json({ error: 'Accès refusé' });
  next();
}

function peutIntervenir(reclamation: { demandeur_id: string }, req: Request) {
  return (
    reclamation.demandeur_id === req.user!.userId ||
    req.user!.role === 'md_center_assistant' ||
    req.user!.role === 'admin'
  );
}

const RECLAMATION_SELECT = {
  id: true,
  titre: true,
  description: true,
  statut: true,
  demandeur_id: true,
  cloture_par: true,
  cloture_le: true,
  motif_cloture: true,
  piece_jointe_nom: true,
  piece_jointe_type: true,
  cree_le: true,
  modifie_le: true,
  demandeur: { select: { nom: true, prenom: true, role: true } },
  clotureur: { select: { nom: true, prenom: true } },
};

const COMMENTAIRE_SELECT = {
  id: true,
  reclamation_id: true,
  auteur_id: true,
  contenu: true,
  piece_jointe_nom: true,
  piece_jointe_type: true,
  cree_le: true,
  auteur: { select: { id: true, nom: true, prenom: true, role: true } },
};

router.get('/', notGuest, async (_req, res) => {
  try {
    const reclamations = await prisma.reclamation.findMany({
      select: { ...RECLAMATION_SELECT, _count: { select: { commentaires: true } } },
      orderBy: { cree_le: 'desc' },
    });
    res.json(reclamations);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/:id', notGuest, async (req, res) => {
  try {
    const reclamation = await prisma.reclamation.findUnique({
      where: { id: req.params.id },
      select: {
        ...RECLAMATION_SELECT,
        commentaires: { select: COMMENTAIRE_SELECT, orderBy: { cree_le: 'asc' } },
      },
    });
    if (!reclamation) return res.status(404).json({ error: 'Réclamation non trouvée' });
    res.json(reclamation);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/:id/piece-jointe', notGuest, async (req, res) => {
  try {
    const r = await prisma.reclamation.findUnique({
      where: { id: req.params.id },
      select: { piece_jointe_nom: true, piece_jointe_type: true, piece_jointe_data: true },
    });
    if (!r?.piece_jointe_data) return res.status(404).json({ error: 'Aucune pièce jointe' });
    res.setHeader('Content-Type', r.piece_jointe_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(r.piece_jointe_nom || 'fichier')}"`);
    res.send(r.piece_jointe_data);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/commentaires/:commentId/piece-jointe', notGuest, async (req, res) => {
  try {
    const c = await prisma.reclamationCommentaire.findUnique({
      where: { id: req.params.commentId },
      select: { piece_jointe_nom: true, piece_jointe_type: true, piece_jointe_data: true },
    });
    if (!c?.piece_jointe_data) return res.status(404).json({ error: 'Aucune pièce jointe' });
    res.setHeader('Content-Type', c.piece_jointe_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(c.piece_jointe_nom || 'fichier')}"`);
    res.send(c.piece_jointe_data);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/', requireRole(...CREATE_ROLES), uploadFichier, async (req, res) => {
  try {
    const { titre, description } = req.body;
    if (!titre?.trim() || !description?.trim()) {
      return res.status(400).json({ error: 'Titre et description requis' });
    }
    const fichier = req.file;
    const reclamation = await prisma.reclamation.create({
      data: {
        titre: titre.trim(),
        description: description.trim(),
        demandeur_id: req.user!.userId,
        ...(fichier && {
          piece_jointe_nom: fichier.originalname,
          piece_jointe_type: fichier.mimetype,
          piece_jointe_data: fichier.buffer,
        }),
      },
      select: RECLAMATION_SELECT,
    });
    res.status(201).json(reclamation);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/:id/commentaires', notGuest, uploadFichier, async (req, res) => {
  try {
    const reclamation = await prisma.reclamation.findUnique({ where: { id: req.params.id } });
    if (!reclamation) return res.status(404).json({ error: 'Réclamation non trouvée' });
    if (reclamation.statut === 'cloturee') return res.status(403).json({ error: 'Réclamation clôturée' });
    if (!peutIntervenir(reclamation, req)) return res.status(403).json({ error: 'Accès refusé' });

    const { contenu } = req.body;
    const fichier = req.file;
    if (!contenu?.trim() && !fichier) return res.status(400).json({ error: 'Contenu ou pièce jointe requis' });

    const commentaire = await prisma.reclamationCommentaire.create({
      data: {
        reclamation_id: reclamation.id,
        auteur_id: req.user!.userId,
        contenu: contenu?.trim() || '',
        ...(fichier && {
          piece_jointe_nom: fichier.originalname,
          piece_jointe_type: fichier.mimetype,
          piece_jointe_data: fichier.buffer,
        }),
      },
      select: COMMENTAIRE_SELECT,
    });

    const passeEnCours = req.user!.role === 'md_center_assistant' && reclamation.statut === 'ouverte';
    await prisma.reclamation.update({
      where: { id: reclamation.id },
      data: { modifie_le: new Date(), ...(passeEnCours && { statut: 'en_cours' }) },
    });

    res.status(201).json(commentaire);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/:id/cloturer', notGuest, async (req, res) => {
  try {
    const reclamation = await prisma.reclamation.findUnique({ where: { id: req.params.id } });
    if (!reclamation) return res.status(404).json({ error: 'Réclamation non trouvée' });
    if (reclamation.statut === 'cloturee') return res.status(403).json({ error: 'Réclamation déjà clôturée' });
    if (!peutIntervenir(reclamation, req)) return res.status(403).json({ error: 'Accès refusé' });

    const { motif } = req.body;
    if (!motif?.trim()) return res.status(400).json({ error: 'Motif de clôture requis' });

    const updated = await prisma.reclamation.update({
      where: { id: reclamation.id },
      data: { statut: 'cloturee', cloture_par: req.user!.userId, cloture_le: new Date(), motif_cloture: motif.trim() },
      select: RECLAMATION_SELECT,
    });
    res.json(updated);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
