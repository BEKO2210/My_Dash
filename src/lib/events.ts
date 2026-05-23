import type Database from "better-sqlite3";
import type { EventRow } from "./types";

// An event with its stored payload parsed back into an object (the raw JSON string
// is dropped). This is what the single-event detail endpoint returns and what the
// drill-down viewers consume.
export interface EventDetail extends Omit<EventRow, "payload_json"> {
  payload: unknown;
}

export function withParsedPayload(row: EventRow): EventDetail {
  const { payload_json, ...rest } = row;
  let payload: unknown = null;
  try {
    payload = JSON.parse(payload_json);
  } catch {
    payload = null; // tolerate a corrupt/legacy payload rather than 500
  }
  return { ...rest, payload };
}

export function eventById(db: Database.Database, id: number): EventRow | undefined {
  return db.prepare(`SELECT * FROM events WHERE id = ?`).get(id) as EventRow | undefined;
}
