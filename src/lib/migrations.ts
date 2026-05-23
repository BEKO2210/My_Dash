import type Database from "better-sqlite3";

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMA MIGRATIONS
// Ordered, append-only list. The (1-based) position of a migration is the schema
// version it brings the database to, tracked via SQLite's `PRAGMA user_version`.
//
// Rules:
//   • NEVER edit or reorder a migration once it has shipped — only append new ones.
//   • Migration 1 is the baseline. It uses IF NOT EXISTS so it adopts databases
//     created before this runner existed (those sit at user_version 0 already).
//   • Later migrations run exactly once, in order, each in its own transaction.
// ─────────────────────────────────────────────────────────────────────────────

export const MIGRATIONS: string[] = [
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
];

// Apply any migrations the database hasn't seen yet. Each runs in a transaction
// together with the version bump, so a failure rolls back cleanly and leaves the
// version untouched. Returns the resulting schema version. Safe to call on boot.
export function migrate(db: Database.Database): number {
  const current = db.pragma("user_version", { simple: true }) as number;
  for (let v = current; v < MIGRATIONS.length; v++) {
    const sql = MIGRATIONS[v];
    db.transaction(() => {
      db.exec(sql);
      // user_version takes a literal, not a bound parameter; v is a controlled index.
      db.pragma(`user_version = ${v + 1}`);
    })();
  }
  return MIGRATIONS.length;
}
