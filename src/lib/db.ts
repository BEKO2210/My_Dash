import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";

// Schema lives here as the single source of truth (avoids runtime file-path lookups
// that break under Next's bundling). Every statement is IF NOT EXISTS → safe to run on each boot.
const SCHEMA = `
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
`;

function createDb(): Database.Database {
  // Packaged builds (Electron) pass MC_DATA_DIR (a stable per-user location);
  // source runs fall back to ./data next to the project.
  const dataDir = process.env.MC_DATA_DIR || path.join(process.cwd(), "data");
  mkdirSync(dataDir, { recursive: true });
  const db = new Database(path.join(dataDir, "mission-control.db"));
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  db.exec(SCHEMA);
  return db;
}

// Reuse one connection across Next.js hot reloads in dev (avoids leaking handles).
const globalForDb = globalThis as unknown as { __mcDb?: Database.Database };

export const db: Database.Database = globalForDb.__mcDb ?? createDb();
if (process.env.NODE_ENV !== "production") globalForDb.__mcDb = db;
