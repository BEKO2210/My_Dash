import type Database from "better-sqlite3";
import type { SessionRow } from "./types";

// Kanban data for /api/sessions. Kept out of the route so it's unit-testable.
export type SessionCard = SessionRow & {
  event_count: number;
  tool_count: number;
  stale?: boolean;
};

// All sessions (newest activity first) with derived event/tool counts. Uses two
// grouped aggregates joined to the session list — one indexed scan each — instead
// of a correlated subquery per row (an N+1 of 2×rows queries) on this
// frequently-polled route. Output is identical to the old per-row subqueries.
export function sessionCards(db: Database.Database, limit: number): SessionCard[] {
  return db
    .prepare(
      `SELECT s.*,
              COALESCE(ec.n, 0) AS event_count,
              COALESCE(tc.n, 0) AS tool_count
       FROM sessions s
       LEFT JOIN (SELECT session_id, COUNT(*) AS n FROM events     GROUP BY session_id) ec ON ec.session_id = s.id
       LEFT JOIN (SELECT session_id, COUNT(*) AS n FROM tool_calls GROUP BY session_id) tc ON tc.session_id = s.id
       ORDER BY datetime(s.last_seen) DESC
       LIMIT ?`,
    )
    .all(limit) as SessionCard[];
}

// Single source of truth for the "stuck active/waiting session" threshold.
// A session with no recent event whose row still says active/waiting (no
// SessionEnd hook ever arrived) is treated as ended past this cutoff so it
// stops piling up in the "waiting" column and stops being counted as live.
// Every callsite that asks "is this session live?" must go through this helper —
// otherwise stats/graph/list disagree (root cause of the 31-vs-2 KPI bug).
// Override via MC_STALE_MINUTES (default 30).
export function staleMinutes(): number {
  const m = Number(process.env.MC_STALE_MINUTES);
  return Number.isFinite(m) && m > 0 ? m : 30;
}

export function staleCutoffMs(now: number = Date.now()): number {
  return now - staleMinutes() * 60_000;
}

// SQLite stores last_seen as UTC "YYYY-MM-DD HH:MM:SS". Same format the
// existing rows already use → comparable directly with >= / <.
export function staleCutoffSql(now: number = Date.now()): string {
  return new Date(staleCutoffMs(now)).toISOString().replace("T", " ").slice(0, 19);
}

// A session that hasn't produced an event in a while but was never formally ended
// (terminal closed, crash, no SessionEnd hook) is shown as ended so it stops
// lingering in the "waiting" column forever. Pure → testable; last_seen is the
// SQLite UTC "YYYY-MM-DD HH:MM:SS" form.
export function markStaleSessions(rows: SessionCard[], cutoffMs: number): SessionCard[] {
  return rows.map((s) => {
    if (s.status !== "ended") {
      const lastSeenMs = Date.parse(s.last_seen.replace(" ", "T") + "Z");
      if (Number.isFinite(lastSeenMs) && lastSeenMs < cutoffMs) {
        return { ...s, status: "ended" as const, stale: true };
      }
    }
    return s;
  });
}
