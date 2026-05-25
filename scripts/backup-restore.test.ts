import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";

// Smoke test for the data-safety scripts (#77): backup + restore must succeed on a
// real DB and fail *cleanly* (non-zero exit + message) when the DB is missing.
const repoRoot = process.cwd();
let tmp: string;
let dataDir: string;
let backupDir: string;

function run(script: string, args: string[], env: Record<string, string>) {
  return spawnSync("node", [path.join("scripts", script), ...args], {
    cwd: repoRoot,
    env: { ...process.env, ...env },
    encoding: "utf8",
  });
}

beforeAll(() => {
  tmp = mkdtempSync(path.join(os.tmpdir(), "mc-backup-test-"));
  dataDir = path.join(tmp, "data");
  backupDir = path.join(tmp, "backups");
  mkdirSync(dataDir, { recursive: true });
  // A minimal but valid SQLite database is enough for the online-backup copy.
  const db = new Database(path.join(dataDir, "mission-control.db"));
  db.exec("CREATE TABLE t (id INTEGER PRIMARY KEY); INSERT INTO t VALUES (1);");
  db.close();
});

afterAll(() => {
  if (tmp) rmSync(tmp, { recursive: true, force: true });
});

describe("backup/restore scripts", () => {
  it("backup succeeds and writes a snapshot", () => {
    const r = run("backup.mjs", [], { MC_DATA_DIR: dataDir, MC_BACKUP_DIR: backupDir });
    expect(r.status, r.stderr).toBe(0);
    const snaps = readdirSync(backupDir).filter((f) => f.startsWith("mission-control-") && f.endsWith(".db"));
    expect(snaps.length).toBeGreaterThanOrEqual(1);
  });

  it("backup fails cleanly (non-zero + message) when the DB is missing", () => {
    const r = run("backup.mjs", [], { MC_DATA_DIR: path.join(tmp, "nope"), MC_BACKUP_DIR: backupDir });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/Keine Datenbank gefunden/);
  });

  it("restore succeeds from the newest snapshot", () => {
    const r = run("restore.mjs", [], { MC_DATA_DIR: dataDir, MC_BACKUP_DIR: backupDir });
    expect(r.status, r.stderr).toBe(0);
    expect(existsSync(path.join(dataDir, "mission-control.db"))).toBe(true);
  });

  it("restore fails cleanly (non-zero + message) for a non-existent snapshot", () => {
    const r = run("restore.mjs", [path.join(tmp, "does-not-exist.db")], {
      MC_DATA_DIR: dataDir,
      MC_BACKUP_DIR: backupDir,
    });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/nicht gefunden/);
  });
});
