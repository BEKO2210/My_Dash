import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { PHASE_PRODUCTION_BUILD } from "next/constants";
import { migrate } from "./migrations";

function createDb(): Database.Database {
  // During `next build`, route modules are evaluated by several workers in parallel.
  // Opening the real database file then races on the SQLite lock ("database is
  // locked"). The build only needs the schema to exist for page-data collection, so
  // use a throwaway in-memory database during the build phase.
  if (process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD) {
    const mem = new Database(":memory:");
    migrate(mem);
    return mem;
  }

  // Packaged builds (Electron) pass MC_DATA_DIR (a stable per-user location);
  // source runs fall back to ./data next to the project.
  const dataDir = process.env.MC_DATA_DIR || path.join(process.cwd(), "data");
  mkdirSync(dataDir, { recursive: true });
  const db = new Database(path.join(dataDir, "mission-control.db"));
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  migrate(db);
  return db;
}

// Reuse one connection across Next.js hot reloads in dev (avoids leaking handles).
const globalForDb = globalThis as unknown as { __mcDb?: Database.Database };

export const db: Database.Database = globalForDb.__mcDb ?? createDb();
if (process.env.NODE_ENV !== "production") globalForDb.__mcDb = db;
