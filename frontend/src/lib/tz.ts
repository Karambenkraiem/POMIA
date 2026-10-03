// La centrale est en Tunisie, qui n'observe plus l'heure d'été depuis 2009 :
// le décalage est un UTC+1 fixe. On l'explicite partout plutôt que de dépendre
// du fuseau horaire ambiant du navigateur/téléphone ou du serveur, qui varie
// selon l'appareil et casse silencieusement l'affichage (décalage d'1h).
const TUNIS_OFFSET_MIN = 60;

const pad = (n: number) => String(n).padStart(2, '0');

/** "yyyy-MM-ddTHH:mm" (saisie locale voulue en Tunisie) -> ISO UTC réel, pour l'API. */
export function tunisLocalToISOString(naive: string): string {
  return new Date(`${naive}:00+01:00`).toISOString();
}

/** ISO UTC (renvoyé par l'API) -> "HH:mm" en heure de Tunisie, pour l'affichage. */
export function formatTunisHM(isoUtc: string): string {
  const t = new Date(new Date(isoUtc).getTime() + TUNIS_OFFSET_MIN * 60000);
  return `${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}`;
}

/** ISO UTC -> heure (0-23) en heure de Tunisie, pour faire correspondre un créneau. */
export function getTunisHour(isoUtc: string): number {
  return new Date(new Date(isoUtc).getTime() + TUNIS_OFFSET_MIN * 60000).getUTCHours();
}

/** ISO UTC -> "yyyy-MM-ddTHH:mm" en heure de Tunisie, pour re-remplir un input datetime-local. */
export function formatTunisDateTimeLocal(isoUtc: string): string {
  const t = new Date(new Date(isoUtc).getTime() + TUNIS_OFFSET_MIN * 60000);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}T${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}`;
}
