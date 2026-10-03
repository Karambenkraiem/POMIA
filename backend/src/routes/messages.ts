import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/') || file.mimetype === 'application/pdf';
    if (ok) cb(null, true);
    else cb(new Error('Type de fichier non autorisé'));
  },
});

function uploadFichier(req: Request, res: Response, next: NextFunction) {
  upload.single('fichier')(req, res, (err: any) => {
    if (err) return res.status(400).json({ error: err.message || 'Fichier invalide' });
    next();
  });
}

const MESSAGE_SELECT = {
  id: true,
  expediteur_id: true,
  destinataire_id: true,
  contenu: true,
  piece_jointe_nom: true,
  piece_jointe_type: true,
  lu: true,
  cree_le: true,
};

router.use(authenticate);
router.use((req: Request, res: Response, next: NextFunction) => {
  if (req.user!.role === 'guest') return res.status(403).json({ error: 'Accès refusé' });
  next();
});

router.get('/contacts', async (req, res) => {
  try {
    const me = req.user!.userId;
    const contacts = await prisma.utilisateur.findMany({
      where: { role: { not: 'guest' }, actif: true, id: { not: me } },
      select: { id: true, nom: true, prenom: true, matricule: true, role: true },
      orderBy: { nom: 'asc' },
    });

    const unread = await prisma.message.groupBy({
      by: ['expediteur_id'],
      where: { destinataire_id: me, lu: false },
      _count: { _all: true },
    });
    const unreadMap = new Map(unread.map((u) => [u.expediteur_id, u._count._all]));

    const mesMessages = await prisma.message.findMany({
      where: { OR: [{ expediteur_id: me }, { destinataire_id: me }] },
      orderBy: { cree_le: 'desc' },
      select: { expediteur_id: true, destinataire_id: true, contenu: true, piece_jointe_nom: true, cree_le: true },
    });
    const dernierParContact = new Map<string, { contenu: string; piece_jointe_nom: string | null; cree_le: Date }>();
    for (const m of mesMessages) {
      const autreId = m.expediteur_id === me ? m.destinataire_id : m.expediteur_id;
      if (!dernierParContact.has(autreId)) {
        dernierParContact.set(autreId, { contenu: m.contenu, piece_jointe_nom: m.piece_jointe_nom, cree_le: m.cree_le });
      }
    }

    const result = contacts
      .map((c) => {
        const dernier = dernierParContact.get(c.id);
        return {
          ...c,
          unread: unreadMap.get(c.id) ?? 0,
          dernierMessage: dernier ? (dernier.contenu || (dernier.piece_jointe_nom ? `📎 ${dernier.piece_jointe_nom}` : '')) : null,
          dernierMessageLe: dernier?.cree_le ?? null,
        };
      })
      .sort((a, b) => {
        const ta = a.dernierMessageLe ? new Date(a.dernierMessageLe).getTime() : 0;
        const tb = b.dernierMessageLe ? new Date(b.dernierMessageLe).getTime() : 0;
        return tb - ta;
      });

    res.json(result);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/unread-count', async (req, res) => {
  try {
    const count = await prisma.message.count({ where: { destinataire_id: req.user!.userId, lu: false } });
    res.json({ count });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/conversation/:userId', async (req, res) => {
  try {
    const me = req.user!.userId;
    const autre = req.params.userId;
    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { expediteur_id: me, destinataire_id: autre },
          { expediteur_id: autre, destinataire_id: me },
        ],
      },
      select: MESSAGE_SELECT,
      orderBy: { cree_le: 'asc' },
    });
    await prisma.message.updateMany({
      where: { expediteur_id: autre, destinataire_id: me, lu: false },
      data: { lu: true },
    });
    res.json(messages);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/:messageId/piece-jointe', async (req, res) => {
  try {
    const me = req.user!.userId;
    const message = await prisma.message.findUnique({
      where: { id: req.params.messageId },
      select: { expediteur_id: true, destinataire_id: true, piece_jointe_nom: true, piece_jointe_type: true, piece_jointe_data: true },
    });
    if (!message || (message.expediteur_id !== me && message.destinataire_id !== me)) {
      return res.status(404).json({ error: 'Pièce jointe non trouvée' });
    }
    if (!message.piece_jointe_data) return res.status(404).json({ error: 'Aucune pièce jointe' });
    res.setHeader('Content-Type', message.piece_jointe_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(message.piece_jointe_nom || 'fichier')}"`);
    res.send(message.piece_jointe_data);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/', uploadFichier, async (req, res) => {
  try {
    const { destinataire_id, contenu } = req.body;
    const fichier = req.file;
    if (!destinataire_id || (!contenu?.trim() && !fichier)) {
      return res.status(400).json({ error: 'Destinataire et contenu ou pièce jointe requis' });
    }
    const dest = await prisma.utilisateur.findUnique({ where: { id: destinataire_id } });
    if (!dest || !dest.actif || dest.role === 'guest') {
      return res.status(400).json({ error: 'Destinataire invalide' });
    }
    const message = await prisma.message.create({
      data: {
        expediteur_id: req.user!.userId,
        destinataire_id,
        contenu: contenu?.trim() || '',
        ...(fichier && {
          piece_jointe_nom: fichier.originalname,
          piece_jointe_type: fichier.mimetype,
          piece_jointe_data: fichier.buffer,
        }),
      },
      select: MESSAGE_SELECT,
    });
    res.status(201).json(message);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
