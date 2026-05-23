import type Database from "better-sqlite3";

// Velocity / degradation signal: per-day throughput (tool calls per active minute)
// and density (events per session) over time, with a moving average to smooth
// outliers and a window-over-window delta to flag drift. Pure derivations are
// unit-tested; the DB function just gathers raw per-day aggregates.

export interface VelocityDay {
  date: string; // YYYY-MM-DD (UTC)
  toolCalls: number;
  events: number;
  sessions: number;
  activeMinutes: number;
}

export function velocitySeries(db: Database.Database, days: number, now: Date = new Date()): VelocityDay[] {
  const startKey = new Date(now.getTime() - (days - 1) * 86_400_000).toISOString().slice(0, 10);
  const since = `${startKey} 00:00:00`;
  const byDay = (sql: string) =>
    new Map(
      (db.prepare(sql).all(since) as { date: string; n: number }[]).map((r) => [r.date, r.n] as const),
    );

  const tools = byDay(
    `SELECT substr(created_at, 1, 10) AS date, COUNT(*) AS n FROM tool_calls WHERE created_at >= ? GROUP BY date`,
  );
  const events = byDay(
    `SELECT substr(created_at, 1, 10) AS date, COUNT(*) AS n FROM events WHERE created_at >= ? GROUP BY date`,
  );
  const sessions = byDay(
    `SELECT substr(first_seen, 1, 10) AS date, COUNT(*) AS n FROM sessions WHERE first_seen >= ? GROUP BY date`,
  );
  const minutes = byDay(
    `SELECT substr(first_seen, 1, 10) AS date,
            SUM((julianday(last_seen) - julianday(first_seen)) * 1440) AS n
     FROM sessions WHERE first_seen >= ? GROUP BY date`,
  );

  const out: VelocityDay[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = new Date(now.getTime() - i * 86_400_000).toISOString().slice(0, 10);
    out.push({
      date: key,
      toolCalls: tools.get(key) ?? 0,
      events: events.get(key) ?? 0,
      sessions: sessions.get(key) ?? 0,
      activeMinutes: Math.max(0, Math.round(minutes.get(key) ?? 0)),
    });
  }
  return out;
}

export function toolsPerMinute(d: VelocityDay): number {
  return d.activeMinutes > 0 ? d.toolCalls / d.activeMinutes : 0;
}

export function eventsPerSession(d: VelocityDay): number {
  return d.sessions > 0 ? d.events / d.sessions : 0;
}

// Trailing moving average; the first values use as many points as available.
export function movingAverage(values: number[], window: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - window + 1);
    const slice = values.slice(start, i + 1);
    out.push(slice.reduce((a, b) => a + b, 0) / slice.length);
  }
  return out;
}

// Relative change of the last `window` mean vs the previous `window` mean.
// Returns 0 when there isn't enough history or the previous mean is 0.
export function trendDelta(values: number[], window: number): number {
  if (values.length < window * 2) return 0;
  const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const recent = mean(values.slice(-window));
  const prior = mean(values.slice(-window * 2, -window));
  if (prior === 0) return 0;
  return (recent - prior) / prior;
}
