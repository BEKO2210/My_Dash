import type Database from "better-sqlite3";
import type { EventRow } from "./types";

// Parse a Last-Event-ID header (or ?lastEventId= query) into a positive integer
// event id, or null when absent/invalid.
export function parseLastEventId(value: string | null | undefined): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// One SSE frame. Including an `id:` line lets the browser send Last-Event-ID on
// automatic reconnect so the server can replay the gap.
export function sseFrame(id: number | null, data: unknown): string {
  const idLine = id != null ? `id: ${id}\n` : "";
  return `${idLine}data: ${JSON.stringify(data)}\n\n`;
}

// Events newer than `sinceId`, oldest-first, capped. Used to replay the gap after
// a reconnect (both the SSE stream and the /api/events backlog).
export function eventsSince(db: Database.Database, sinceId: number, limit: number): EventRow[] {
  return db
    .prepare(`SELECT * FROM events WHERE id > ? ORDER BY id ASC LIMIT ?`)
    .all(sinceId, limit) as EventRow[];
}

// Highest event id currently stored (0 when empty) — used to size the reconnect
// gap before deciding whether a full replay is possible.
export function latestEventId(db: Database.Database): number {
  const row = db.prepare(`SELECT MAX(id) AS id FROM events`).get() as { id: number | null };
  return row.id ?? 0;
}

// A reconnect gap larger than the replay cap can't be replayed in full without
// silently dropping the events between (sinceId + limit) and the newest id. In
// that case the client should refetch its backlog from /api/events instead.
export function gapTooLarge(latestId: number, sinceId: number, limit: number): boolean {
  return latestId - sinceId > limit;
}

// A control frame telling the client its replay was truncated: it should drop any
// assumption of continuity and refetch the recent backlog. Deliberately carries no
// `id:` line — it isn't a real event and must not become the next Last-Event-ID.
export function sseResetFrame(): string {
  return `data: ${JSON.stringify({ reset: true })}\n\n`;
}
