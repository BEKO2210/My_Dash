import type Database from "better-sqlite3";

// Bounded growth for the high-volume tables. We keep the newest N rows by id and
// drop the rest. Limits are configurable; a value <= 0 disables pruning for that
// table (unlimited).
const DEFAULT_LIMIT = 100_000;
// The alert inbox is deduped (one row per rule+key) so it grows far slower than
// the event stream — a smaller default keeps it tidy without losing real history.
const DEFAULT_ALERT_LIMIT = 5_000;

export function retentionLimit(envName: string, fallback = DEFAULT_LIMIT): number {
  const raw = process.env[envName];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return n < 0 ? 0 : Math.trunc(n);
}

// Tables pruned by row count (newest-`max`-by-id retained). All have an INTEGER
// PRIMARY KEY AUTOINCREMENT `id`, so the cutoff is a single indexed lookup.
type CappedTable = "events" | "tool_calls" | "otlp_metric" | "otlp_log" | "alerts";

// Delete everything older than the newest `max` rows. Uses the id index, so it's
// cheap even on a large table. Returns how many rows were removed.
export function pruneTable(db: Database.Database, table: CappedTable, max: number): number {
  if (max <= 0) return 0;
  const cutoff = db
    .prepare(`SELECT id FROM ${table} ORDER BY id DESC LIMIT 1 OFFSET ?`)
    .get(max) as { id: number } | undefined;
  if (!cutoff) return 0; // fewer than `max` rows — nothing to drop
  return db.prepare(`DELETE FROM ${table} WHERE id <= ?`).run(cutoff.id).changes;
}

// Drop rows in a tool_call side table whose tool_call was pruned, so the side
// table can't outgrow tool_calls. Returns how many orphans were removed.
export function pruneOrphans(db: Database.Database, table: "tool_io" | "file_edits"): number {
  return db
    .prepare(`DELETE FROM ${table} WHERE tool_call_id NOT IN (SELECT id FROM tool_calls)`)
    .run().changes;
}

// Drop prompts whose backing event was pruned, so prompt history stays bounded to
// the retained events instead of growing forever. Returns how many were removed.
export function prunePromptOrphans(db: Database.Database): number {
  return db
    .prepare(
      `DELETE FROM prompts WHERE event_id IS NOT NULL AND event_id NOT IN (SELECT id FROM events)`,
    )
    .run().changes;
}

// Drop session_links that pointed at a pruned tool_call (today every link is a
// 'subagent' link recorded off a Task tool_call). Links with no tool_call_id
// (reserved for future child-session correlation) are kept. Returns removed count.
export function pruneSessionLinkOrphans(db: Database.Database): number {
  return db
    .prepare(
      `DELETE FROM session_links
       WHERE tool_call_id IS NOT NULL AND tool_call_id NOT IN (SELECT id FROM tool_calls)`,
    )
    .run().changes;
}

// The FTS index is standalone (not external-content), so pruning events/prompts
// leaves dangling rows that both bloat the index and surface search hits pointing
// at deleted records. Drop FTS rows whose backing event/prompt no longer exists.
// Must run AFTER events + prompts are pruned. Returns how many were removed.
export function pruneSearchOrphans(db: Database.Database): number {
  return db
    .prepare(
      `DELETE FROM search_fts
       WHERE (kind = 'event'  AND ref_id NOT IN (SELECT id FROM events))
          OR (kind = 'prompt' AND ref_id NOT IN (SELECT id FROM prompts))`,
    )
    .run().changes;
}

export interface PruneReport {
  events: number;
  toolCalls: number;
  toolIo: number;
  fileEdits: number;
  prompts: number;
  sessionLinks: number;
  searchFts: number;
  otlpMetric: number;
  otlpLog: number;
  alerts: number;
}

export function pruneAll(db: Database.Database): PruneReport {
  // Prune the primary high-volume tables first…
  const events = pruneTable(db, "events", retentionLimit("MC_MAX_EVENTS"));
  const toolCalls = pruneTable(db, "tool_calls", retentionLimit("MC_MAX_TOOL_CALLS"));

  // …then everything keyed off them, so orphan cleanup sees the post-prune state.
  // Each dependent sweep is a full scan, so only run it when its parent actually
  // dropped rows — otherwise (the common case, tables under their limit) it's a
  // no-op we can skip on the hot ingest path.
  const prompts = events > 0 ? prunePromptOrphans(db) : 0;
  const toolIo = toolCalls > 0 ? pruneOrphans(db, "tool_io") : 0;
  const fileEdits = toolCalls > 0 ? pruneOrphans(db, "file_edits") : 0;
  const sessionLinks = toolCalls > 0 ? pruneSessionLinkOrphans(db) : 0;
  const searchFts = events > 0 || prompts > 0 ? pruneSearchOrphans(db) : 0;

  // Independent, separately-capped tables: the optional OTLP receiver and the
  // (deduped) alert inbox. Both grow without bound otherwise.
  const otlpMetric = pruneTable(db, "otlp_metric", retentionLimit("MC_MAX_OTLP_METRICS"));
  const otlpLog = pruneTable(db, "otlp_log", retentionLimit("MC_MAX_OTLP_LOGS"));
  const alerts = pruneTable(db, "alerts", retentionLimit("MC_MAX_ALERTS", DEFAULT_ALERT_LIMIT));

  return {
    events,
    toolCalls,
    toolIo,
    fileEdits,
    prompts,
    sessionLinks,
    searchFts,
    otlpMetric,
    otlpLog,
    alerts,
  };
}
