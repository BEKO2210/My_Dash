import type Database from "better-sqlite3";
import { level } from "./heatmap";

// Year calendar (GitHub-style): per-day activity folded into week-columns. Days
// come from the hour activity_buckets, which survive event pruning, so the year
// view stays intact. Pure layout in buildCalendar so it's unit-testable.

export interface CalDayCount {
  date: string; // YYYY-MM-DD (UTC)
  count: number;
}

// Per-day event counts over the last `days` days (oldest first, gaps filled).
export function dailyActivity(db: Database.Database, days: number, now: Date = new Date()): CalDayCount[] {
  const startKey = new Date(now.getTime() - (days - 1) * 86_400_000).toISOString().slice(0, 10);
  const rows = db
    .prepare(
      `SELECT substr(bucket, 1, 10) AS date, SUM(count) AS count
       FROM activity_buckets
       WHERE bucket >= ?
       GROUP BY date`,
    )
    .all(`${startKey} 00`) as CalDayCount[];
  const map = new Map(rows.map((r) => [r.date, r.count]));
  const out: CalDayCount[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = new Date(now.getTime() - i * 86_400_000).toISOString().slice(0, 10);
    out.push({ date: key, count: map.get(key) ?? 0 });
  }
  return out;
}

export interface CalDay {
  date: string;
  count: number;
  level: number; // 0..4
}

export interface CalendarYear {
  weeks: (CalDay | null)[][]; // each inner array has 7 cells (Mon..Sun)
  months: { month: number; week: number }[]; // month label anchored to a week column
  total: number;
  max: number;
}

// UTC weekday, Monday-first (Mon=0 … Sun=6).
function weekdayMon(date: string): number {
  return (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
}

export function buildCalendar(series: CalDayCount[]): CalendarYear {
  const nonzero = series
    .map((s) => s.count)
    .filter((c) => c > 0)
    .sort((a, b) => a - b);
  const clamp = nonzero.length ? nonzero[Math.floor((nonzero.length - 1) * 0.95)] : 0;

  const weeks: (CalDay | null)[][] = [];
  let current: (CalDay | null)[] = [];
  let total = 0;
  let max = 0;

  series.forEach((s, i) => {
    if (i === 0) {
      const pad = weekdayMon(s.date);
      for (let p = 0; p < pad; p++) current.push(null);
    }
    current.push({ date: s.date, count: s.count, level: level(s.count, clamp) });
    total += s.count;
    if (s.count > max) max = s.count;
    if (current.length === 7) {
      weeks.push(current);
      current = [];
    }
  });
  if (current.length > 0) {
    while (current.length < 7) current.push(null);
    weeks.push(current);
  }

  const months: { month: number; week: number }[] = [];
  let lastMonth = -1;
  weeks.forEach((wk, wi) => {
    const first = wk.find((c): c is CalDay => c !== null);
    if (!first) return;
    const m = new Date(`${first.date}T00:00:00Z`).getUTCMonth();
    if (m !== lastMonth) {
      months.push({ month: m, week: wi });
      lastMonth = m;
    }
  });

  return { weeks, months, total, max };
}
