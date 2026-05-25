#!/usr/bin/env node
// Creates a consistent snapshot of the dashboard database — safe to run even
// while the server is using it (SQLite online backup, WAL-aware).
//
//   npm run backup
//
// Snapshots land in  backups/mission-control-<timestamp>.db  and the newest
// MC_BACKUP_KEEP (default 14) are kept; older ones are pruned.

import Database from "better-sqlite3";
import { mkdirSync, readdirSync, statSync, unlinkSync, existsSync } from "node:fs";
import path from "node:path";

const KEEP = Number(process.env.MC_BACKUP_KEEP) > 0 ? Number(process.env.MC_BACKUP_KEEP) : 14;
// Honour the same data location as the app (Electron passes MC_DATA_DIR); the
// backup directory is overridable too.
const dataDir = process.env.MC_DATA_DIR || path.join(process.cwd(), "data");
const src = path.join(dataDir, "mission-control.db");
const backupDir = process.env.MC_BACKUP_DIR || path.join(process.cwd(), "backups");

if (!existsSync(src)) {
  console.error(`Keine Datenbank gefunden: ${src}\nLäuft das Dashboard schon? (./start.sh)`);
  process.exit(1);
}
mkdirSync(backupDir, { recursive: true });

const ts = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
const dest = path.join(backupDir, `mission-control-${ts}.db`);

const db = new Database(src, { fileMustExist: true });
try {
  await db.backup(dest);
  const mb = (statSync(dest).size / 1024 / 1024).toFixed(2);
  console.log(`✓ Backup: ${path.relative(process.cwd(), dest)} (${mb} MB)`);
} catch (err) {
  console.error(`✗ Backup fehlgeschlagen: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
} finally {
  db.close();
}

// Keep only the newest KEEP snapshots.
const files = readdirSync(backupDir)
  .filter((f) => f.startsWith("mission-control-") && f.endsWith(".db"))
  .map((f) => ({ f, t: statSync(path.join(backupDir, f)).mtimeMs }))
  .sort((a, b) => b.t - a.t);

const stale = files.slice(KEEP);
for (const { f } of stale) unlinkSync(path.join(backupDir, f));
if (stale.length) console.log(`  ${stale.length} alte(s) Backup(s) entfernt (behalte ${KEEP}).`);
