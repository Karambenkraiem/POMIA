import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { genererDonneesDemo } from '../lib/demo-data';

const router = Router();

type Etat = { etat: 'inactif' | 'en_cours' | 'termine' | 'erreur'; message: string };
let etat: Etat = { etat: 'inactif', message: '' };

const MESSAGES_ERREUR: Record<string, string> = {
  DONNEES_PRESENTES: 'La base contient déjà des journées : aucune donnée fictive ajoutée.',
  UTILISATEURS_MANQUANTS: "Créez d'abord les utilisateurs (seed) avant de générer les données.",
};

router.use(authenticate, requireRole('admin'));

router.get('/statut', (_req, res) => {
  res.json(etat);
});

router.post('/generer', (_req, res) => {
  if (etat.etat === 'en_cours') return res.status(409).json({ error: 'Génération déjà en cours' });

  etat = { etat: 'en_cours', message: 'Génération des données fictives en cours…' };
  genererDonneesDemo()
    .then(() => {
      etat = { etat: 'termine', message: 'Données fictives générées avec succès.' };
    })
    .catch((err: Error) => {
      etat = { etat: 'erreur', message: MESSAGES_ERREUR[err.message] ?? 'Erreur pendant la génération.' };
    });

  res.status(202).json(etat);
});

export default router;
