import type Database from "better-sqlite3";

export interface HealthReport {
  ok: boolean;
  db: "ok" | "error";
  schemaVersion?: number;
  sessions?: number;
  events?: number;
  toolCalls?: number;
  uptimeSec: number;
  version: string;
  now: string;
}

// Snapshot of the dashboard's liveness: DB reachability, schema version and row
// counts. Pure (takes the db handle) so it can be unit-tested; the route wraps it.
export function collectHealth(
  db: Database.Database,
  opts: { version: string; uptimeSec: number; now?: string },
): HealthReport {
  const base = {
    version: opts.version,
    uptimeSec: opts.uptimeSec,
    now: opts.now ?? new Date().toISOString(),
  };
  try {
    const schemaVersion = db.pragma("user_version", { simple: true }) as number;
    const count = (table: "sessions" | "events" | "tool_calls") =>
      (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
    return {
      ok: true,
      db: "ok",
      schemaVersion,
      sessions: count("sessions"),
      events: count("events"),
      toolCalls: count("tool_calls"),
      ...base,
    };
  } catch {
    return { ok: false, db: "error", ...base };
  }
}
