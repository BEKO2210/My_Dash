import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { MIGRATIONS } from "@/lib/migrations";

// Exercise the real db module against a throwaway data dir (set before import so
// createDb opens the disposable file, not the project's ./data).
let db: (typeof import("@/lib/db"))["db"];
let dataDir: string;

beforeAll(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), "mc-db-test-"));
  process.env.MC_DATA_DIR = dataDir;
  ({ db } = await import("@/lib/db"));
});

afterAll(() => {
  rmSync(dataDir, { recursive: true, force: true });
  delete process.env.MC_DATA_DIR;
});

describe("db", () => {
  it("opens a fully-migrated database file under MC_DATA_DIR", () => {
    expect(existsSync(path.join(dataDir, "mission-control.db"))).toBe(true);
    expect(db.pragma("user_version", { simple: true })).toBe(MIGRATIONS.length);
    const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as {
      name: string;
    }[]).map((r) => r.name);
    expect(tables).toEqual(expect.arrayContaining(["sessions", "events", "tool_calls", "alerts"]));
  });

  it("runs in WAL mode with NORMAL synchronous (see #86)", () => {
    expect(String(db.pragma("journal_mode", { simple: true })).toLowerCase()).toBe("wal");
    expect(db.pragma("synchronous", { simple: true })).toBe(1); // 1 = NORMAL
  });

  it("round-trips a row", () => {
    db.prepare("INSERT INTO sessions (id, status) VALUES ('db-test', 'active')").run();
    expect(
      (db.prepare("SELECT status FROM sessions WHERE id = 'db-test'").get() as { status: string })
        .status,
    ).toBe("active");
  });
});
