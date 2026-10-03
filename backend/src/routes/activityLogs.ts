import { Router } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();
router.use(authenticate, requireRole('admin', 'chef_exploitation'));

router.get('/', async (req, res) => {
  try {
    const take = Math.min(Number(req.query.limit) || 200, 500);
    const logs = await prisma.activityLog.findMany({
      orderBy: { cree_le: 'desc' },
      take,
    });
    res.json(logs);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
