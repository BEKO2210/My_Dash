// Single source of truth for the database schema, as an ordered, append-only list
// of migrations (see src/lib/migrations.ts for the runner). Plain JS so both the
// TypeScript app and the import-history backfill script (.mjs) can share it and
// never drift. NEVER edit or reorder a shipped migration — only append.
export const MIGRATIONS = [
  // v1 — baseline schema (sessions, events, tool_calls + indexes).
  `
  CREATE TABLE IF NOT EXISTS sessions (
    id            TEXT PRIMARY KEY,
    project_path  TEXT,
    project_name  TEXT,
    title         TEXT,
    status        TEXT NOT NULL DEFAULT 'active',
    source        TEXT,
    first_seen    DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen     DATETIME DEFAULT CURRENT_TIMESTAMP,
    ended_at      DATETIME,
    token_input   INTEGER DEFAULT 0,
    token_output  INTEGER DEFAULT 0,
    cost_usd      REAL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS events (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id    TEXT NOT NULL,
    event_type    TEXT NOT NULL,
    tool_name     TEXT,
    summary       TEXT,
    payload_json  TEXT NOT NULL,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS tool_calls (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id    TEXT NOT NULL,
    tool_name     TEXT NOT NULL,
    target        TEXT,
    duration_ms   INTEGER,
    success       INTEGER,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id);
  CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at);
  CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
  CREATE INDEX IF NOT EXISTS idx_tool_calls_session ON tool_calls(session_id);
  `,

  // v2 — per-tool-call I/O (raw input/output + error flag) for the tool inspector
  // and error panels. Keyed 1:1 to tool_calls.id; pruned alongside it (retention).
  `
  CREATE TABLE IF NOT EXISTS tool_io (
    tool_call_id  INTEGER PRIMARY KEY,
    input_json    TEXT,
    output_json   TEXT,
    is_error      INTEGER NOT NULL DEFAULT 0,
    error_text    TEXT
  );
  `,

  // v3 — model name per event (best-effort from the payload now; transcript
  // tailing fills it in reliably later). Powers per-model analytics.
  `
  ALTER TABLE events ADD COLUMN model TEXT;
  `,

  // v4 — cached-token total per session (input/output/cost columns already exist).
  `
  ALTER TABLE sessions ADD COLUMN token_cache INTEGER DEFAULT 0;
  `,

  // v5 — classify tool calls: builtin vs MCP, and the MCP server when applicable.
  `
  ALTER TABLE tool_calls ADD COLUMN source TEXT;
  ALTER TABLE tool_calls ADD COLUMN mcp_server TEXT;
  `,

  // v6 — parent/child links between sessions. Today a Task tool call records a
  // 'subagent' link off its parent session (hooks don't expose a separate child
  // session id; child_session_id is kept for future correlation). Powers the tree.
  `
  CREATE TABLE IF NOT EXISTS session_links (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_session_id  TEXT NOT NULL,
    child_session_id   TEXT,
    tool_call_id       INTEGER,
    kind               TEXT NOT NULL DEFAULT 'subagent',
    label              TEXT,
    created_at         DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_session_links_parent ON session_links(parent_session_id);
  `,

  // v7 — prompts as first-class, queryable rows (redacted + capped text, token
  // estimate). Powers the prompt-history and tag-cloud widgets.
  `
  CREATE TABLE IF NOT EXISTS prompts (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id      TEXT NOT NULL,
    event_id        INTEGER,
    text            TEXT,
    token_estimate  INTEGER DEFAULT 0,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_prompts_session ON prompts(session_id);
  `,

  // v8 — per-file change estimates from Edit/Write/NotebookEdit for hotspots.
  `
  CREATE TABLE IF NOT EXISTS file_edits (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id    TEXT NOT NULL,
    tool_call_id  INTEGER,
    path          TEXT NOT NULL,
    added         INTEGER DEFAULT 0,
    removed       INTEGER DEFAULT 0,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_file_edits_path ON file_edits(path);
  CREATE INDEX IF NOT EXISTS idx_file_edits_session ON file_edits(session_id);
  `,

  // v9 — git context per session (captured read-only from the cwd at SessionStart).
  `
  ALTER TABLE sessions ADD COLUMN branch TEXT;
  ALTER TABLE sessions ADD COLUMN git_commit TEXT;
  `,

  // v10 — hour-granularity activity rollup (counts per type) for fast heatmaps /
  // time-series. Kept even after raw events are pruned.
  `
  CREATE TABLE IF NOT EXISTS activity_buckets (
    bucket      TEXT NOT NULL,
    event_type  TEXT NOT NULL,
    count       INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (bucket, event_type)
  );
  `,

  // v11 — generic app config (key/value), e.g. budget limits.
  `
  CREATE TABLE IF NOT EXISTS config (
    key   TEXT PRIMARY KEY,
    value TEXT
  );
  `,

  // v12 — transcript file path per session, so the read-only transcript viewer can
  // re-read Claude Code's JSONL on demand (path only; contents stay on disk).
  `
  ALTER TABLE sessions ADD COLUMN transcript_path TEXT;
  `,

  // v13 — FTS5 full-text index over event summaries + prompt text, kept in sync at
  // ingest. Standalone (not external-content) so a single MATCH spans both sources.
  // Backfilled once from existing rows.
  `
  CREATE VIRTUAL TABLE IF NOT EXISTS search_fts USING fts5(
    text,
    kind UNINDEXED,
    ref_id UNINDEXED,
    session_id UNINDEXED
  );
  INSERT INTO search_fts (text, kind, ref_id, session_id)
    SELECT summary, 'event', id, session_id FROM events WHERE summary IS NOT NULL AND summary <> '';
  INSERT INTO search_fts (text, kind, ref_id, session_id)
    SELECT text, 'prompt', id, session_id FROM prompts WHERE text IS NOT NULL AND text <> '';
  `,

  // v14 — per-plugin settings (a small JSON blob per widget id) for the settings
  // drawer. Separate from the hook-ingest write path; only the config route writes.
  `
  CREATE TABLE IF NOT EXISTS plugin_config (
    plugin_id   TEXT PRIMARY KEY,
    config_json TEXT NOT NULL DEFAULT '{}',
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  `,

  // v15 — read-only alerting: rules (conditions over the event stream) evaluated at
  // ingest, and the alerts they raise. The unique (rule_id, dedup_key) index keeps
  // a firing condition from spamming. Seeded with sensible default rules.
  `
  CREATE TABLE IF NOT EXISTS alert_rules (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    type      TEXT NOT NULL,
    threshold REAL NOT NULL DEFAULT 0,
    enabled   INTEGER NOT NULL DEFAULT 1,
    label     TEXT
  );
  CREATE TABLE IF NOT EXISTS alerts (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_id    INTEGER,
    type       TEXT NOT NULL,
    message    TEXT NOT NULL,
    session_id TEXT,
    dedup_key  TEXT,
    read       INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_alerts_dedup ON alerts(rule_id, dedup_key);
  CREATE INDEX IF NOT EXISTS idx_alerts_read ON alerts(read);
  INSERT INTO alert_rules (type, threshold, enabled, label) VALUES
    ('mcp_error', 0, 1, 'MCP tool failed'),
    ('error_spike', 0.25, 1, 'Error-rate spike'),
    ('session_long', 120, 1, 'Long-running session'),
    ('cost_session', 5, 1, 'Session cost over budget');
  `,

  // v16 — optional OTLP receiver (a SECOND read-only ingress, off by default).
  // Claude Code's OpenTelemetry exporter can post metrics/logs here when MC_OTLP_ENABLED=1.
  // Kept deliberately isolated from the hook-driven model: raw-ish rows land in their own
  // tables so the OTLP path can never corrupt sessions/events. Mapping + reconcile with the
  // core model happens in a later run; this run only receives and stores.
  `
  CREATE TABLE IF NOT EXISTS otlp_metric (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ts          TEXT,
    name        TEXT NOT NULL,
    session_id  TEXT,
    model       TEXT,
    value       REAL NOT NULL DEFAULT 0,
    attrs       TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_otlp_metric_name ON otlp_metric(name);
  CREATE INDEX IF NOT EXISTS idx_otlp_metric_session ON otlp_metric(session_id);
  CREATE TABLE IF NOT EXISTS otlp_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ts          TEXT,
    name        TEXT NOT NULL,
    session_id  TEXT,
    model       TEXT,
    body        TEXT,
    attrs       TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_otlp_log_name ON otlp_log(name);
  CREATE INDEX IF NOT EXISTS idx_otlp_log_session ON otlp_log(session_id);
  `,

  // v17 — git remote URL per session, so branches can be correlated to the repo and
  // a "open PR" link can be built (read-only, derived locally from the origin remote).
  `
  ALTER TABLE sessions ADD COLUMN remote_url TEXT;
  `,

  // v18 — optional multi-machine aggregation. NULL = this (local) machine; a label
  // marks sessions read-only-synced in from another machine's DB (scripts/sync-machine.mjs).
  `
  ALTER TABLE sessions ADD COLUMN machine TEXT;
  CREATE INDEX IF NOT EXISTS idx_sessions_machine ON sessions(machine);
  `,
];
