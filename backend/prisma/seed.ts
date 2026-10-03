import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const SEUILS_ALARME = [
  { parametre: 'spread_echappement', valeur_min: null, valeur_max: 50, unite: '°C', description: 'Ecart max entre thermocouples echappement' },
  { parametre: 'vibration_maxi', valeur_min: null, valeur_max: 25, unite: 'mm/s', description: 'Vibration maximale admissible paliers' },
  { parametre: 'temp_metal_blanc_max', valeur_min: null, valeur_max: 110, unite: '°C', description: 'Temperature metal blanc paliers' },
  { parametre: 'temp_inter_roue_ecart', valeur_min: null, valeur_max: 30, unite: '°C', description: 'Ecart temperature inter-roues' },
  { parametre: 'pression_gaz_min', valeur_min: 10, valeur_max: null, unite: 'bar', description: 'Pression gaz minimale skid' },
  { parametre: 'puissance_max_tg', valeur_min: null, valeur_max: 130, unite: 'MW', description: 'Puissance maximale turbine' },
];

const DEFAULT_PASSWORD = process.env.SEED_DEFAULT_PASSWORD || '123456';

// Personas entièrement fictifs — dépôt de démonstration publique, aucune donnée réelle.
const UTILISATEURS: { nom: string; prenom: string; matricule: string; role: string }[] = [
  { nom: 'Admin', prenom: 'Système', matricule: 'ADMIN001', role: 'admin' },
  { nom: 'TRABELSI', prenom: 'Youssef', matricule: '80001', role: 'chef_quart' },
  { nom: 'MEJRI', prenom: 'Sami', matricule: '80002', role: 'chef_bloc' },
  { nom: 'HAMMAMI', prenom: 'Nour', matricule: '80003', role: 'operateur' },
  { nom: 'BOUAZIZI', prenom: 'Rania', matricule: '80004', role: 'chef_quart' },
  { nom: 'GHARBI', prenom: 'Anis', matricule: '80005', role: 'chef_bloc' },
  { nom: 'SAIDI', prenom: 'Yassine', matricule: '80006', role: 'operateur' },
  { nom: 'KHELIFI', prenom: 'Imen', matricule: '80007', role: 'chef_quart' },
  { nom: 'ROMDHANE', prenom: 'Wael', matricule: '80008', role: 'chef_bloc' },
  { nom: 'JEBALI', prenom: 'Sonia', matricule: '80009', role: 'operateur' },
  { nom: 'BEL HAJ', prenom: 'Marwen', matricule: '80010', role: 'chef_quart' },
  { nom: 'NASRI', prenom: 'Hela', matricule: '80011', role: 'operateur' },
  { nom: 'CHAABANE', prenom: 'Fares', matricule: '80012', role: 'directeur' },
  { nom: 'GUESMI', prenom: 'Leila', matricule: '80013', role: 'chef_centrale' },
  { nom: 'AMRI', prenom: 'Tarek', matricule: '80014', role: 'chef_exploitation' },
  { nom: 'ZOUARI', prenom: 'Nadia', matricule: '80015', role: 'operateur' },
  { nom: 'Center', prenom: 'MD Assistant', matricule: '80016', role: 'md_center_assistant' },
  { nom: 'DRIDI', prenom: 'Mehdi', matricule: '80017', role: 'chef_maintenance' },
];

async function main() {
  for (const seuil of SEUILS_ALARME) {
    await prisma.seuilAlarme.upsert({
      where: { parametre: seuil.parametre },
      update: {},
      create: seuil,
    });
  }
  console.log(`Seuils d'alarme: ${SEUILS_ALARME.length} vérifiés/créés.`);

  const hash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  for (const u of UTILISATEURS) {
    await prisma.utilisateur.upsert({
      where: { matricule: u.matricule },
      update: { nom: u.nom, prenom: u.prenom, role: u.role as any, mot_de_passe_hash: hash, modifie_le: new Date() },
      create: { ...u, role: u.role as any, mot_de_passe_hash: hash },
    });
  }
  console.log(`Utilisateurs: ${UTILISATEURS.length} créés/mis à jour. Mot de passe réinitialisé à: ${DEFAULT_PASSWORD}`);

  // Compte invité à accès rapide — toujours disponible, matricule/mot de passe fixes (00000/00000).
  const guestHash = await bcrypt.hash('00000', 10);
  await prisma.utilisateur.upsert({
    where: { matricule: '00000' },
    update: { nom: 'Invité', prenom: 'Accès rapide', role: 'guest', mot_de_passe_hash: guestHash, actif: true, modifie_le: new Date() },
    create: { nom: 'Invité', prenom: 'Accès rapide', matricule: '00000', role: 'guest', mot_de_passe_hash: guestHash },
  });
  console.log('Compte invité 00000/00000 vérifié/créé.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
