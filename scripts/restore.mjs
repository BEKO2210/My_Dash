#!/usr/bin/env node
// Restore the dashboard database from a backup snapshot (see scripts/backup.mjs).
//
//   npm run restore                 # restore the newest snapshot
//   npm run restore <file|path>     # restore a specific snapshot (name or path)
//
// Stop the dashboard first. Before overwriting, the current database is snapshotted
// to <backups>/pre-restore-<timestamp>.db, so the restore is itself reversible.
// Honours MC_DATA_DIR and MC_BACKUP_DIR (same as backup).

import Database from "better-sqlite3";
import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";

const dataDir = process.env.MC_DATA_DIR || path.join(process.cwd(), "data");
const backupDir = process.env.MC_BACKUP_DIR || path.join(process.cwd(), "backups");
const liveDb = path.join(dataDir, "mission-control.db");

function newestBackup() {
  if (!existsSync(backupDir)) return null;
  const files = readdirSync(backupDir)
    .filter((f) => f.startsWith("mission-control-") && f.endsWith(".db"))
    .map((f) => ({ f, t: statSync(path.join(backupDir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  return files.length ? path.join(backupDir, files[0].f) : null;
}

// Accept an explicit path, a bare filename inside the backup dir, or default to
// the newest snapshot.
function resolveSource(arg) {
  if (!arg) return newestBackup();
  if (existsSync(arg)) return path.resolve(arg);
  const inDir = path.join(backupDir, arg);
  return existsSync(inDir) ? inDir : null;
}

function timestamp() {
  return new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
}

function isSqlite(file) {
  try {
    const db = new Database(file, { fileMustExist: true, readonly: true });
    db.pragma("schema_version");
    db.close();
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const arg = process.argv[2];
  const src = resolveSource(arg);
  if (!src) {
    console.error(
      arg
        ? `Backup nicht gefunden: ${arg} (gesucht in ${backupDir})`
        : `Keine Backups in ${backupDir}. Erst "npm run backup" ausführen.`,
    );
    process.exit(1);
  }
  if (!isSqlite(src)) {
    console.error(`Keine gültige SQLite-Datenbank: ${src}`);
    process.exit(1);
  }

  mkdirSync(dataDir, { recursive: true });
  mkdirSync(backupDir, { recursive: true });

  // Reversibility: snapshot the current database before replacing it.
  if (existsSync(liveDb)) {
    const safety = path.join(backupDir, `pre-restore-${timestamp()}.db`);
    const cur = new Database(liveDb, { fileMustExist: true });
    try {
      await cur.backup(safety);
      console.log(`✓ Aktuelle DB gesichert: ${path.relative(process.cwd(), safety)}`);
    } finally {
      cur.close();
    }
  }

  // Write a clean copy of the snapshot to the live path (online backup → a single
  // consistent file), then drop any stale WAL/SHM sidecars so SQLite doesn't
  // replay the previous database's WAL over the restored file.
  const snap = new Database(src, { fileMustExist: true });
  try {
    await snap.backup(liveDb);
  } finally {
    snap.close();
  }
  for (const side of ["-wal", "-shm"]) {
    const f = liveDb + side;
    if (existsSync(f)) rmSync(f);
  }

  console.log(
    `✓ Wiederhergestellt: ${path.relative(process.cwd(), src)} → ${path.relative(process.cwd(), liveDb)}`,
  );
  console.log("Starte das Dashboard neu, um die wiederhergestellten Daten zu sehen.");
}

main().catch((err) => {
  console.error("Restore fehlgeschlagen:", err.message);
  process.exit(1);
});
