#!/usr/bin/env node
// Optional multi-machine aggregation: read sessions out of ANOTHER machine's
// dashboard DB (read-only) and merge them into this machine's DB, tagged with a
// machine label, so the dashboard shows a combined view.
//
//   node scripts/sync-machine.mjs <path-to-other/mission-control.db> [machineId]
//   npm run machine:sync -- ../laptop-backup/mission-control.db laptop
//
// Only the sessions table is merged (UUID ids — collision-free). The source DB is
// opened read-only and never modified. Re-running is idempotent (upsert by id).
// Mirrors src/lib/machine-sync.ts (kept in sync deliberately).

import Database from "better-sqlite3";
import { existsSync } from "node:fs";
import path from "node:path";
import { MIGRATIONS } from "../src/lib/migrations-sql.mjs";

const SYNC_COLUMNS = [
  "id",
  "project_path",
  "project_name",
  "title",
  "status",
  "source",
  "first_seen",
  "last_seen",
  "ended_at",
  "token_input",
  "token_output",
  "token_cache",
  "cost_usd",
  "branch",
  "git_commit",
  "remote_url",
  "transcript_path",
];

function migrate(db) {
  const current = db.pragma("user_version", { simple: true });
  for (let v = current; v < MIGRATIONS.length; v++) {
    db.transaction(() => {
      db.exec(MIGRATIONS[v]);
      db.pragma(`user_version = ${v + 1}`);
    })();
  }
}

const srcPath = process.argv[2];
const machineId = process.argv[3] || (srcPath ? path.basename(path.dirname(path.resolve(srcPath))) : "");

if (!srcPath || !machineId) {
  console.error("Usage: node scripts/sync-machine.mjs <other/mission-control.db> [machineId]");
  process.exit(1);
}
if (!existsSync(srcPath)) {
  console.error(`Source database not found: ${srcPath}`);
  process.exit(1);
}

const dataDir = process.env.MC_DATA_DIR || path.join(process.cwd(), "data");
const primaryPath = path.join(dataDir, "mission-control.db");
if (!existsSync(primaryPath)) {
  console.error(`Local database not found: ${primaryPath}\nStart the dashboard once first.`);
  process.exit(1);
}

const source = new Database(srcPath, { readonly: true, fileMustExist: true });
const primary = new Database(primaryPath);
primary.pragma("journal_mode = WAL");
primary.pragma("busy_timeout = 5000");
migrate(primary);

const rows = source.prepare(`SELECT ${SYNC_COLUMNS.join(", ")} FROM sessions`).all();

const cols = [...SYNC_COLUMNS, "machine"];
const placeholders = cols.map(() => "?").join(", ");
const updates = cols.filter((c) => c !== "id").map((c) => `${c} = excluded.${c}`).join(", ");
const stmt = primary.prepare(
  `INSERT INTO sessions (${cols.join(", ")}) VALUES (${placeholders})
   ON CONFLICT(id) DO UPDATE SET ${updates}`,
);
const exists = primary.prepare(`SELECT 1 FROM sessions WHERE id = ?`);

let inserted = 0;
let updated = 0;
primary.transaction((rs) => {
  for (const r of rs) {
    if (typeof r.id !== "string" || !r.id) continue;
    const had = exists.get(r.id);
    stmt.run(...SYNC_COLUMNS.map((c) => r[c]), machineId);
    if (had) updated += 1;
    else inserted += 1;
  }
})(rows);

source.close();
primary.close();

console.log(`sync-machine: machine="${machineId}" — ${inserted} inserted, ${updated} updated (${rows.length} sessions).`);
