import prisma from './lib/prisma';
import { TrancheHoraire } from '@prisma/client';

function hourToTranche(hour: number): TrancheHoraire | null {
  if (hour >= 0 && hour < 8) return TrancheHoraire.h00_07h;
  if (hour >= 8 && hour < 14) return TrancheHoraire.h07_14h;
  if (hour >= 14 && hour < 20) return TrancheHoraire.h14_20h;
  if (hour >= 20) return TrancheHoraire.h20_00h;
  return null;
}

async function createAutoReleve() {
  try {
    const now = new Date();
    const hour = now.getHours();

    if (hour % 2 !== 0) return;

    const tranche = hourToTranche(hour);
    if (!tranche) return;

    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const today = new Date(dateStr + 'T00:00:00.000Z');
    const journee = await prisma.journee.findUnique({ where: { jour: today } });
    if (!journee) return;

    const poste = await prisma.poste.findUnique({
      where: { journee_id_tranche: { journee_id: journee.id, tranche } },
    });
    if (!poste) return;

    const heureReleve = new Date(`${dateStr}T${hour.toString().padStart(2, '0')}:00:00`);
    const start = new Date(heureReleve);
    const end = new Date(heureReleve.getTime() + 60_000);

    const existing = await prisma.relevesOperateur.findFirst({
      where: { journee_id: journee.id, heure_releve: { gte: start, lt: end } },
    });
    if (existing) return;

    await prisma.relevesOperateur.create({
      data: { journee_id: journee.id, poste_id: poste.id, heure_releve: heureReleve },
    });

    console.log(`[CRON] Relevé opérateur initialisé — ${hour.toString().padStart(2, '0')}h00`);
  } catch (err) {
    console.error('[CRON] Erreur création relevé auto:', err);
  }
}

export function startReleveCron() {
  // Check immediately in case server starts at an even hour
  createAutoReleve();

  // Check every 10 minutes; only acts at even hours within first 10 min of the hour
  setInterval(createAutoReleve, 10 * 60 * 1000);

  console.log('[CRON] Planificateur de relevés opérateur démarré (toutes les 2h)');
}
