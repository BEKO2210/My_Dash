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

export interface CompactionSummary {
  total: number;
  auto: number;
  manual: number;
}

export function compactionSummary(compactions: Compaction[]): CompactionSummary {
  let auto = 0;
  let manual = 0;
  for (const c of compactions) {
    if (c.trigger === "manual") manual += 1;
    else auto += 1;
  }
  return { total: compactions.length, auto, manual };
}

export interface CompactionDay {
  date: string; // YYYY-MM-DD (UTC)
  count: number;
}

// Per-day compaction counts over the last `days` days (oldest first, gaps filled).
export function compactionDaily(
  compactions: Compaction[],
  days: number,
  now: Date = new Date(),
): CompactionDay[] {
  const counts = new Map<string, number>();
  for (const c of compactions) {
    const key = (c.created_at.includes("T") ? c.created_at : c.created_at.replace(" ", "T")).slice(0, 10);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const out: CompactionDay[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = new Date(now.getTime() - i * 86_400_000).toISOString().slice(0, 10);
    out.push({ date: key, count: counts.get(key) ?? 0 });
  }
  return out;
}
