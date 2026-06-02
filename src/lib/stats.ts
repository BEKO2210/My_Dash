import type Database from "better-sqlite3";
import { errorStats } from "./errors";
import { staleCutoffSql } from "./session-list";

// Headline KPIs for the status strip: cheap DB aggregates plus a 24h event
// sparkline (from the activity rollup). Cost is added by the route (ccusage).
export interface DashboardStats {
  activeSessions: number;
  eventsToday: number;
  toolCallsToday: number;
  errorRate: number; // 0..1 over today's tool calls
  sparkline: number[]; // events per hour, last 24h (oldest -> newest)
}

export function collectStats(db: Database.Database, now: Date = new Date()): DashboardStats {
  const dayStart = `${now.toISOString().slice(0, 10)} 00:00:00`;
  // Use the shared staleness cutoff so this count matches /api/sessions, the
  // kanban widget, and the 3D graph. Rows whose status is still active/waiting
  // but whose last_seen is older than the cutoff are treated as ended.
  const activeSessions = (
    db
      .prepare(`SELECT COUNT(*) AS n FROM sessions WHERE status != 'ended' AND last_seen >= ?`)
      .get(staleCutoffSql(now.getTime())) as { n: number }
  ).n;
  const eventsToday = (
    db.prepare(`SELECT COUNT(*) AS n FROM events WHERE created_at >= ?`).get(dayStart) as {
      n: number;
    }
  ).n;
  const err = errorStats(db, dayStart);

  // 24h sparkline from the activity rollup, with missing hours filled as 0.
  const since = new Date(now.getTime() - 23 * 3_600_000);
  const sinceBucket = since.toISOString().replace("T", " ").slice(0, 13);
  const rows = db
    .prepare(`SELECT bucket, SUM(count) AS c FROM activity_buckets WHERE bucket >= ? GROUP BY bucket`)
    .all(sinceBucket) as { bucket: string; c: number }[];
  const map = new Map(rows.map((r) => [r.bucket, r.c]));
  const sparkline: number[] = [];
  for (let i = 23; i >= 0; i--) {
    const key = new Date(now.getTime() - i * 3_600_000).toISOString().replace("T", " ").slice(0, 13);
    sparkline.push(map.get(key) ?? 0);
  }

  return {
    activeSessions,
    eventsToday,
    toolCallsToday: err.toolCalls,
    errorRate: err.errorRate,
    sparkline,
  };
}
