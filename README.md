# POMIA — Plateforme des Opérations, Maintenance, Information et Analyse

Application de supervision d'exploitation pour sites industriels et centrales de production
(gestion des rondes, relevés, incidents, maintenance et communication d'équipe) — conçue
initialement pour une centrale turbine à gaz, adaptable à d'autres environnements industriels
nécessitant un suivi d'exploitation rigoureux poste par poste.

> **Dépôt de démonstration publique.** Les données qu'il contient sont fictives, générées pour
> illustrer les fonctionnalités de l'application — aucune donnée réelle d'exploitation.

## Fonctionnalités

- **Journée d'exploitation** — postes de quart (4 tranches horaires/jour), validation hiérarchique
- **Relevés Chef de Bloc** — saisie toutes les 2h (turbine, générateur, huile, vibrations,
  échappement, métal blanc) avec verrouillage après validation
- **Relevés Opérateur** — relevés périodiques, compteurs journaliers, bilan énergétique
- **Manœuvres & Incidents** — journal chronologique avec autocomplétion
- **Alarmes répétitives** — suivi avec première apparition et équipement concerné
- **Ordres de Travaux** — curatif/préventif, par discipline
- **Demandes de Service** et **Matériels Défectueux**
- **Essais périodiques** — paramétrage par fréquence (journalier → annuel, jours de semaine
  personnalisables), déclenchement automatique, historique par essai, verrouillage post-validation
- **Consignes** — liste vivante, relançable avec nouvelle date d'échéance
- **Réclamations & Assistance** — ticketing avec fil de discussion, pièces jointes, clôture motivée
- **Messagerie interne** — chat entre agents, pièces jointes image/vidéo/PDF, prise de photo/vidéo
  directe
- **Analyse & Diagnostic** — graphiques de tendance multi-paramètres
- **Rapport journalier** imprimable et **feuilles journalières** (vue transposée)
- **Administration** — utilisateurs et rôles, seuils d'alarme, journal d'activité (traçabilité)
- **Application mobile** (Android/iOS via Capacitor) + **PWA installable**
- **Mode démo** — connexion en un clic par profil, sans mot de passe à retenir

## Stack technique

- **Frontend** : React 18 + TypeScript + Vite + TailwindCSS (+ Capacitor pour Android/iOS)
- **Backend** : Node.js + Express + Prisma ORM
- **Base de données** : PostgreSQL 16
- **Déploiement** : Docker Compose

## Lancement rapide (développement)

```bash
# Copier et adapter les variables d'environnement
cp .env.example .env

# Démarrer l'application complète
docker compose up --build

# Peupler avec des utilisateurs de démonstration
docker compose exec backend npx prisma db seed
```

- Frontend : http://localhost:5173
- Backend API : http://localhost:3004/api
- Base de données : localhost:5434

## Compte administrateur par défaut

| Matricule | Mot de passe     |
|-----------|------------------|
| ADMIN001  | Admin@POMIA2024  |

> Changer le mot de passe après la première connexion. En mode démo (`DEMO_LOGIN=true`), un
> panneau d'accès rapide permet de se connecter en un clic avec n'importe quel profil de
> démonstration.
