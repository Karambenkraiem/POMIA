import { Router } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/journee/:journeeId', async (req, res) => {
  try {
    const manouvres = await prisma.manouvre.findMany({
      where: { journee_id: req.params.journeeId },
      include: { saiseur: { select: { nom: true, prenom: true } } },
      orderBy: { heure_manouvre: 'asc' },
    });
    res.json(manouvres);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// La Tunisie n'observe plus l'heure d'été depuis 2009 : décalage UTC+1 fixe
// (même logique que frontend/src/lib/tz.ts, dupliquée car le backend travaille en UTC brut).
const TUNIS_OFFSET_MIN = 60;

function tunisHour(d: Date): number {
  return new Date(d.getTime() + TUNIS_OFFSET_MIN * 60000).getUTCHours();
}

function hourToTranche(h: number) {
  if (h < 8) return 'h00_07h';
  if (h < 14) return 'h07_14h';
  if (h < 20) return 'h14_20h';
  return 'h20_00h';
}

// Recherche textuelle dans les manœuvres/incidents sur un intervalle, avec le chef de
// quart en poste au moment de chaque résultat (retrouvé via la tranche horaire, car
// poste_id n'est jamais renseigné par le formulaire de saisie).
router.get('/recherche', requireRole('chef_quart', 'chef_exploitation', 'directeur', 'admin'), async (req, res) => {
  try {
    const { texte, type, from, to } = req.query;
    if (!from || !to || typeof from !== 'string' || typeof to !== 'string') {
      return res.status(400).json({ error: 'Paramètres from/to requis (yyyy-MM-dd)' });
    }

    const where: any = {
      heure_manouvre: { gte: new Date(`${from}T00:00:00.000Z`), lte: new Date(`${to}T23:59:59.999Z`) },
    };
    if (type === 'incident') where.type_manouvre = 'incident';
    else if (type === 'manoeuvre') where.type_manouvre = { not: 'incident' };
    if (texte && typeof texte === 'string' && texte.trim()) {
      where.description = { contains: texte.trim(), mode: 'insensitive' };
    }

    const manouvres = await prisma.manouvre.findMany({
      where,
      orderBy: { heure_manouvre: 'asc' },
      take: 300,
    });

    const journeeIds = [...new Set(manouvres.map((m) => m.journee_id))];
    const postes = journeeIds.length
      ? await prisma.poste.findMany({
          where: { journee_id: { in: journeeIds } },
          include: { chefQuart: { select: { nom: true, prenom: true } } },
        })
      : [];

    const results = manouvres.map((m) => {
      const tranche = hourToTranche(tunisHour(m.heure_manouvre));
      const poste = postes.find((p) => p.journee_id === m.journee_id && p.tranche === tranche);
      return {
        id: m.id,
        heure_manouvre: m.heure_manouvre,
        description: m.description,
        type_manouvre: m.type_manouvre,
        chef_quart: poste?.chefQuart ? `${poste.chefQuart.prenom} ${poste.chefQuart.nom}` : null,
      };
    });

    res.json(results);
  } catch (err: any) {
    console.error('[GET /manouvres/recherche]', err);
    res.status(500).json({ error: err.message ?? 'Erreur serveur' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { journee_id, poste_id, heure_manouvre, description, type_manouvre, feuille_numero } = req.body;
    if (type_manouvre === 'incident' && !['chef_quart', 'admin'].includes(req.user!.role)) {
      return res.status(403).json({ error: 'Seul le chef de quart ou un administrateur peut saisir un incident' });
    }
    const manouvre = await prisma.manouvre.create({
      data: {
        journee_id,
        poste_id,
        saisi_par: req.user!.userId,
        heure_manouvre: new Date(heure_manouvre),
        description,
        type_manouvre,
        feuille_numero: feuille_numero || 1,
      },
      include: { saiseur: { select: { nom: true, prenom: true } } },
    });
    res.status(201).json(manouvre);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const existing = await prisma.manouvre.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Introuvable' });
    if (existing.type_manouvre === 'incident' && !['chef_quart', 'admin'].includes(req.user!.role)) {
      return res.status(403).json({ error: 'Seul le chef de quart ou un administrateur peut modifier un incident' });
    }

    const { heure_manouvre, description, type_manouvre, feuille_numero } = req.body;
    const manouvre = await prisma.manouvre.update({
      where: { id: req.params.id },
      data: {
        heure_manouvre: heure_manouvre ? new Date(heure_manouvre) : undefined,
        description,
        type_manouvre,
        feuille_numero,
      },
    });
    res.json(manouvre);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const existing = await prisma.manouvre.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Introuvable' });
    if (existing.type_manouvre === 'incident' && !['chef_quart', 'admin'].includes(req.user!.role)) {
      return res.status(403).json({ error: 'Seul le chef de quart ou un administrateur peut supprimer un incident' });
    }
    await prisma.manouvre.delete({ where: { id: req.params.id } });
    res.json({ message: 'Manœuvre supprimée' });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
