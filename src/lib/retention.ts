import type Database from "better-sqlite3";

// Bounded growth for the high-volume tables. We keep the newest N rows by id and
// drop the rest. Limits are configurable; a value <= 0 disables pruning for that
// table (unlimited).
const DEFAULT_LIMIT = 100_000;

export function retentionLimit(envName: string, fallback = DEFAULT_LIMIT): number {
  const raw = process.env[envName];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return n < 0 ? 0 : Math.trunc(n);
}

// Delete everything older than the newest `max` rows. Uses the id index, so it's
// cheap even on a large table. Returns how many rows were removed.
export function pruneTable(
  db: Database.Database,
  table: "events" | "tool_calls",
  max: number,
): number {
  if (max <= 0) return 0;
  const cutoff = db
    .prepare(`SELECT id FROM ${table} ORDER BY id DESC LIMIT 1 OFFSET ?`)
    .get(max) as { id: number } | undefined;
  if (!cutoff) return 0; // fewer than `max` rows — nothing to drop
  return db.prepare(`DELETE FROM ${table} WHERE id <= ?`).run(cutoff.id).changes;
}

export function pruneAll(db: Database.Database): { events: number; toolCalls: number } {
  return {
    events: pruneTable(db, "events", retentionLimit("MC_MAX_EVENTS")),
    toolCalls: pruneTable(db, "tool_calls", retentionLimit("MC_MAX_TOOL_CALLS")),
  };
}
