export type LeagueTier = "Gold" | "Silver" | "Bronze";

/** Monday 00:00 (local) of the current week. */
export function weekStart(now = new Date()): Date {
  const d = new Date(now);
  const day = (d.getDay() + 6) % 7; // Mon=0
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d;
}

/** Top 20% Gold, next 30% Silver, rest Bronze. Players with 0 points are Bronze. */
export function tierForRank(rank: number, total: number, points: number): LeagueTier {
  if (points <= 0 || total <= 0) return "Bronze";
  const pct = (rank + 1) / total;
  if (pct <= 0.2 || rank === 0) return "Gold";
  if (pct <= 0.5) return "Silver";
  return "Bronze";
}
