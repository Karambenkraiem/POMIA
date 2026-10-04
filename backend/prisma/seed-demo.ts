import { genererDonneesDemo } from '../src/lib/demo-data';
import prisma from '../src/lib/prisma';

genererDonneesDemo()
  .then(() => console.log('Données de démonstration générées.'))
  .catch((err) => {
    console.error(err.message === 'DONNEES_PRESENTES'
      ? 'La base contient déjà des journées : seed de démo ignoré.'
      : err);
    process.exitCode = err.message === 'DONNEES_PRESENTES' ? 0 : 1;
  })
  .finally(() => prisma.$disconnect());
