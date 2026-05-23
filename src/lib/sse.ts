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
