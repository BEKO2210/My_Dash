import type Database from "better-sqlite3";

// Optional multi-machine aggregation: read sessions out of another machine's
// dashboard DB (opened read-only by the caller) and upsert them into this machine's
// DB, tagged with a machine label. Only the sessions table is merged — its ids are
// UUIDs (globally unique, collision-free), whereas events/tool_calls use autoincrement
// PKs that would collide. The combined view (kanban, leaderboard, cost) then shows
// both machines' sessions. Read-only with respect to the source DB.

// Columns copied verbatim from the source session row (everything except `machine`,
// which we set to the sync label). Mirrors the sessions schema.
const SYNC_COLUMNS = [
  "id",
  "project_path",
  "project_name",
  "title",
  "status",
  "source",
  "first_seen",
  "last_seen",
  "ended_at",
  "token_input",
  "token_output",
  "token_cache",
  "cost_usd",
  "branch",
  "git_commit",
  "remote_url",
  "transcript_path",
] as const;

export type SyncSessionRow = Record<(typeof SYNC_COLUMNS)[number], unknown>;

export interface MergeResult {
  inserted: number;
  updated: number;
}

export function readSessionsForSync(source: Database.Database): SyncSessionRow[] {
  return source.prepare(`SELECT ${SYNC_COLUMNS.join(", ")} FROM sessions`).all() as SyncSessionRow[];
}

// Upsert source rows into `primary`, stamping `machine`. Existing ids are updated
// (idempotent re-sync); local rows (machine IS NULL) are never created here.
export function mergeSessions(primary: Database.Database, rows: SyncSessionRow[], machineId: string): MergeResult {
  const cols = [...SYNC_COLUMNS, "machine"];
  const placeholders = cols.map(() => "?").join(", ");
  const updates = cols.filter((c) => c !== "id").map((c) => `${c} = excluded.${c}`).join(", ");
  const stmt = primary.prepare(
    `INSERT INTO sessions (${cols.join(", ")}) VALUES (${placeholders})
     ON CONFLICT(id) DO UPDATE SET ${updates}`,
  );
  const exists = primary.prepare(`SELECT 1 FROM sessions WHERE id = ?`);

  const result: MergeResult = { inserted: 0, updated: 0 };
  primary.transaction((rs: SyncSessionRow[]) => {
    for (const r of rs) {
      if (typeof r.id !== "string" || !r.id) continue;
      const existed = exists.get(r.id);
      stmt.run(...SYNC_COLUMNS.map((c) => r[c] as never), machineId);
      if (existed) result.updated += 1;
      else result.inserted += 1;
    }
  })(rows);
  return result;
}
