import { Router } from 'express';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { date } = req.query;
    if (!date || typeof date !== 'string') {
      return res.status(400).json({ error: 'Paramètre date requis (YYYY-MM-DD)' });
    }

    const jour = new Date(date + 'T00:00:00.000Z');

    const journee = await prisma.journee.findUnique({
      where: { jour },
      include: {
        postes: {
          include: {
            chefQuart:  { select: { nom: true, prenom: true, matricule: true } },
            chefBloc:   { select: { nom: true, prenom: true, matricule: true } },
            operateur1: { select: { nom: true, prenom: true, matricule: true } },
            operateur2: { select: { nom: true, prenom: true, matricule: true } },
          },
          orderBy: { tranche: 'asc' },
        },
        compteurs: true,
        releves_bloc: {
          include: {
            generateur:  true,
            vibrations:  true,
            echappement: true,
            saiseur: { select: { nom: true, prenom: true, matricule: true } },
          },
          orderBy: { heure_releve: 'asc' },
        },
        manouvres: {
          include: {
            saiseur: { select: { nom: true, prenom: true, matricule: true } },
          },
          orderBy: { heure_manouvre: 'asc' },
        },
        alarmes: {
          orderBy: { heure: 'asc' },
        },
        ordres_travaux: {
          orderBy: { date_debut: 'asc' },
        },
        demandes_service: {
          orderBy: { cree_le: 'asc' },
        },
      },
    });

    const defauts = await prisma.materielDefectueux.findMany({
      where: {
        date_declaration: { lte: new Date(date) },
        OR: [
          { date_cloture: null },
          { date_cloture: { gte: new Date(date) } },
        ],
      },
      orderBy: { date_declaration: 'asc' },
      include: {
        commentaireAuteur: { select: { nom: true, prenom: true } },
      },
    });

    res.json({ journee, defauts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
