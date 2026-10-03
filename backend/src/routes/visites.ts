import { Router } from 'express';
import crypto from 'crypto';
import geoip from 'geoip-lite';
import prisma from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();
const BOT_UA = /bot|crawl|spider|headless|curl|wget|python|monitor|preview|uptime|facebookexternalhit|slackbot|telegram/i;
const SEL = process.env.JWT_SECRET || 'pomia-visites';

function jourLocal(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function compte(liste: { visiteur_hash: string }[]) {
  return { visites: liste.length, visiteurs: new Set(liste.map((v) => v.visiteur_hash)).size };
}

router.post('/', async (req, res) => {
  try {
    const ua = req.get('user-agent') || '';
    if (!ua || BOT_UA.test(ua)) return res.status(204).end();

    const ip = req.ip || '';
    const geo = geoip.lookup(ip);
    const visiteur_hash = crypto
      .createHash('sha256')
      .update(`${ip}|${ua}|${jourLocal()}|${SEL}`)
      .digest('hex');

    await prisma.visite.create({
      data: {
        pays: geo?.country || 'INCONNU',
        region: geo?.region || null,
        ville: geo?.city || null,
        visiteur_hash,
      },
    });
    res.status(204).end();
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/stats', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const jours = Math.min(Math.max(parseInt(String(req.query.jours ?? '30'), 10) || 30, 1), 365);
    const fenetre = Math.max(jours, 30);
    const debut = new Date(Date.now() - fenetre * 86400000);
    const visites = await prisma.visite.findMany({
      where: { cree_le: { gte: debut } },
      select: { pays: true, region: true, ville: true, visiteur_hash: true, cree_le: true },
    });

    const debutJour = new Date();
    debutJour.setHours(0, 0, 0, 0);
    const il7 = Date.now() - 7 * 86400000;
    const il30 = Date.now() - 30 * 86400000;
    const periode = visites.filter((v) => v.cree_le.getTime() >= Date.now() - jours * 86400000);

    const parLieu = new Map<string, { pays: string; region: string | null; ville: string | null; visiteurs: string[] }>();
    for (const v of periode) {
      const cle = `${v.pays}|${v.region ?? ''}|${v.ville ?? ''}`;
      const entree = parLieu.get(cle) ?? { pays: v.pays, region: v.region, ville: v.ville, visiteurs: [] };
      entree.visiteurs.push(v.visiteur_hash);
      parLieu.set(cle, entree);
    }

    res.json({
      jours,
      aujourdhui: compte(visites.filter((v) => v.cree_le >= debutJour)),
      sept_jours: compte(visites.filter((v) => v.cree_le.getTime() >= il7)),
      trente_jours: compte(visites.filter((v) => v.cree_le.getTime() >= il30)),
      periode: compte(periode),
      parLieu: [...parLieu.values()]
        .map((e) => ({
          pays: e.pays,
          region: e.region,
          ville: e.ville,
          visites: e.visiteurs.length,
          visiteurs: new Set(e.visiteurs).size,
        }))
        .sort((a, b) => b.visites - a.visites),
    });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
