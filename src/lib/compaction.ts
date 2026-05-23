import type Database from "better-sqlite3";
import type { EventRow } from "./types";

// Context compaction. PreCompact hooks carry the trigger (auto|manual) and any
// custom instructions, but not the context size, so that's what we surface. These
// are already stored as events; this just makes them queryable for the timeline.
export interface Compaction {
  id: number;
  session_id: string;
  trigger: string;
  customInstructions: string | null;
  created_at: string;
}

export function parseCompaction(event: EventRow): Compaction {
  let trigger = "auto";
  let customInstructions: string | null = null;
  try {
    const p = JSON.parse(event.payload_json) as Record<string, unknown>;
    if (typeof p.trigger === "string") trigger = p.trigger;
    if (typeof p.custom_instructions === "string") customInstructions = p.custom_instructions;
  } catch {
    /* keep defaults */
  }
  return {
    id: event.id,
    session_id: event.session_id,
    trigger,
    customInstructions,
    created_at: event.created_at,
  };
}

export function recentCompactions(db: Database.Database, limit: number): Compaction[] {
  const rows = db
    .prepare(`SELECT * FROM events WHERE event_type = 'PreCompact' ORDER BY id DESC LIMIT ?`)
    .all(limit) as EventRow[];
  return rows.map(parseCompaction);
}
