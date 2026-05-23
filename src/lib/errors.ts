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
