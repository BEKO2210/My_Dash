import type Database from "better-sqlite3";

// Error feed + rate, derived from the failure flags captured at ingest time
// (tool_calls.success = 0, with the message in tool_io.error_text). Permission
// denials surface here too: they arrive as error tool_responses, so is_error/
// success already mark them. Powers the error-rate widget and the errors panel.

export interface ErrorStats {
  toolCalls: number;
  failures: number;
  errorRate: number; // 0..1
}

export interface ErrorItem {
  id: number; // tool_call id
  session_id: string;
  tool_name: string;
  target: string | null;
  error_text: string | null;
  created_at: string;
}

export function errorStats(db: Database.Database, sinceIso: string | null = null): ErrorStats {
  const cond = sinceIso ? "created_at >= ?" : "1=1";
  const args = sinceIso ? [sinceIso] : [];
  const total = (
    db.prepare(`SELECT COUNT(*) AS n FROM tool_calls WHERE ${cond}`).get(...args) as { n: number }
  ).n;
  const failures = (
    db
      .prepare(`SELECT COUNT(*) AS n FROM tool_calls WHERE success = 0 AND ${cond}`)
      .get(...args) as { n: number }
  ).n;
  return { toolCalls: total, failures, errorRate: total ? failures / total : 0 };
}

// Per-day totals + failures over the last `days` days (oldest first, gaps filled).
export interface ErrorPoint {
  date: string; // YYYY-MM-DD (UTC)
  total: number;
  failures: number;
}

export function errorSeries(db: Database.Database, days: number, now: Date = new Date()): ErrorPoint[] {
  const startKey = new Date(now.getTime() - (days - 1) * 86_400_000).toISOString().slice(0, 10);
  const rows = db
    .prepare(
      `SELECT substr(created_at, 1, 10) AS date,
              COUNT(*) AS total,
              SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) AS failures
       FROM tool_calls
       WHERE created_at >= ?
       GROUP BY date`,
    )
    .all(`${startKey} 00:00:00`) as ErrorPoint[];
  const map = new Map(rows.map((r) => [r.date, r]));
  const out: ErrorPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = new Date(now.getTime() - i * 86_400_000).toISOString().slice(0, 10);
    const r = map.get(key);
    out.push({ date: key, total: r?.total ?? 0, failures: r?.failures ?? 0 });
  }
  return out;
}

// Tools with the most failures (only those with at least one), with their rate.
export interface FailingTool {
  tool: string;
  failures: number;
  total: number;
  rate: number;
}

export function topFailingTools(
  db: Database.Database,
  limit = 6,
  sinceIso: string | null = null,
): FailingTool[] {
  const cond = sinceIso ? "WHERE created_at >= ?" : "";
  const params = sinceIso ? [sinceIso, limit] : [limit];
  const rows = db
    .prepare(
      `SELECT tool_name AS tool,
              COUNT(*) AS total,
              SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) AS failures
       FROM tool_calls
       ${cond}
       GROUP BY tool_name
       HAVING SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) > 0
       ORDER BY failures DESC, tool ASC
       LIMIT ?`,
    )
    .all(...params) as { tool: string; total: number; failures: number }[];
  return rows.map((r) => ({ ...r, rate: r.total ? r.failures / r.total : 0 }));
}

export function recentErrors(db: Database.Database, limit: number): ErrorItem[] {
  return db
    .prepare(
      `SELECT tc.id, tc.session_id, tc.tool_name, tc.target, tc.created_at, io.error_text
       FROM tool_calls tc
       LEFT JOIN tool_io io ON io.tool_call_id = tc.id
       WHERE tc.success = 0
       ORDER BY tc.id DESC
       LIMIT ?`,
    )
    .all(limit) as ErrorItem[];
}
