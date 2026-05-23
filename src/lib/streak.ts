import type Database from "better-sqlite3";
import type { ActivityBucket } from "./activity";

// Productivity rollups: a day-streak of activity, the sessions-per-day trend, and
// a peak-hours histogram. Powers the streak / productivity widget.

export interface DayCount {
  date: string; // YYYY-MM-DD (UTC)
  count: number;
}

export interface StreakStats {
  current: number; // consecutive active days ending today
  longest: number; // longest active run in the window
  activeDays: number; // days with at least one session
  totalSessions: number;
}

// Sessions started per day over the last `days` days (oldest first, gaps filled).
export function dailySessions(db: Database.Database, days: number, now: Date = new Date()): DayCount[] {
  const startKey = new Date(now.getTime() - (days - 1) * 86_400_000).toISOString().slice(0, 10);
  const rows = db
    .prepare(
      `SELECT substr(first_seen, 1, 10) AS date, COUNT(*) AS count
       FROM sessions
       WHERE first_seen >= ?
       GROUP BY date`,
    )
    .all(`${startKey} 00:00:00`) as DayCount[];
  const map = new Map(rows.map((r) => [r.date, r.count]));
  const out: DayCount[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = new Date(now.getTime() - i * 86_400_000).toISOString().slice(0, 10);
    out.push({ date: key, count: map.get(key) ?? 0 });
  }
  return out;
}

// Streak metrics from a gap-filled, oldest→newest day series. The current streak
// counts back from the last day (today): if today is inactive it is 0.
export function streakStats(days: DayCount[]): StreakStats {
  let longest = 0;
  let run = 0;
  let activeDays = 0;
  let totalSessions = 0;
  for (const d of days) {
    totalSessions += d.count;
    if (d.count > 0) {
      run += 1;
      activeDays += 1;
      if (run > longest) longest = run;
    } else {
      run = 0;
    }
  }
  let current = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].count > 0) current += 1;
    else break;
  }
  return { current, longest, activeDays, totalSessions };
}

// Fold UTC hour-buckets into a 24-slot LOCAL-time histogram of event counts.
export function hourHistogram(buckets: ActivityBucket[]): number[] {
  const hours = new Array<number>(24).fill(0);
  for (const b of buckets) {
    const d = new Date(`${b.bucket.replace(" ", "T")}:00:00Z`);
    if (Number.isNaN(d.getTime())) continue;
    hours[d.getHours()] += b.count;
  }
  return hours;
}

// Index (0..23) of the busiest hour, or -1 when there is no activity.
export function peakHour(hours: number[]): number {
  let idx = -1;
  let max = 0;
  hours.forEach((c, i) => {
    if (c > max) {
      max = c;
      idx = i;
    }
  });
  return idx;
}
