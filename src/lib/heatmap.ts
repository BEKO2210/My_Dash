import type { ActivityBucket } from "./activity";

// Fold the hourly activity buckets (UTC) into a weekday × hour grid in LOCAL time
// for a punchcard heatmap. Color clamps at p95 so a few busy hours don't flatten
// the rest (see chart accessibility guidance).
export interface Heatmap {
  grid: number[][]; // [weekday 0=Mon..6=Sun][hour 0..23]
  max: number;
  p95: number;
  total: number;
}

export function foldHeatmap(buckets: ActivityBucket[]): Heatmap {
  const grid: number[][] = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
  for (const b of buckets) {
    const d = new Date(`${b.bucket.replace(" ", "T")}:00:00Z`); // "YYYY-MM-DD HH" is UTC
    if (Number.isNaN(d.getTime())) continue;
    const weekday = (d.getDay() + 6) % 7; // local, Monday-first
    grid[weekday][d.getHours()] += b.count; // local hour
  }
  const values = grid.flat();
  const max = values.reduce((m, v) => Math.max(m, v), 0);
  const total = values.reduce((a, v) => a + v, 0);
  const nonzero = values.filter((v) => v > 0).sort((a, b) => a - b);
  const p95 = nonzero.length ? nonzero[Math.floor((nonzero.length - 1) * 0.95)] : 0;
  return { grid, max, p95, total };
}

// Discrete level 0..4 for a value, clamped so the top bin starts at `clamp`.
export function level(count: number, clamp: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0;
  if (clamp <= 0) return 1;
  return (Math.min(4, Math.ceil((Math.min(count, clamp) / clamp) * 4)) || 1) as 1 | 2 | 3 | 4;
}
