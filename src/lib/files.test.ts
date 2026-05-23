import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { fileHotspots } from "@/lib/files";
import { migrate } from "@/lib/migrations";

let open: Database.Database | null = null;
afterEach(() => {
  open?.close();
  open = null;
});

function seed(): Database.Database {
  const db = (open = new Database(":memory:"));
  migrate(db);
  const ins = db.prepare(
    `INSERT INTO file_edits (session_id, path, added, removed, created_at) VALUES ('s', ?, ?, ?, ?)`,
  );
  ins.run("/a/big.ts", 100, 50, "2026-05-23 10:00:00");
  ins.run("/a/big.ts", 20, 10, "2026-05-23 11:00:00");
  ins.run("/a/small.ts", 5, 1, "2026-05-23 10:00:00");
  ins.run("/a/old.ts", 200, 0, "2026-05-01 10:00:00");
  return db;
}

describe("fileHotspots", () => {
  it("aggregates churn per path, sorted by churn, with name + counts", () => {
    const rows = fileHotspots(seed());
    expect(rows.map((r) => r.path)).toEqual(["/a/old.ts", "/a/big.ts", "/a/small.ts"]);
    const big = rows.find((r) => r.path === "/a/big.ts")!;
    expect(big.edits).toBe(2);
    expect(big.added).toBe(120);
    expect(big.removed).toBe(60);
    expect(big.churn).toBe(180);
    expect(big.name).toBe("big.ts");
  });

  it("filters by the since window", () => {
    const rows = fileHotspots(seed(), 40, "2026-05-23 00:00:00");
    // old.ts (May 1) is excluded -> big.ts is the top hotspot.
    expect(rows[0].path).toBe("/a/big.ts");
    expect(rows.some((r) => r.path === "/a/old.ts")).toBe(false);
  });

  it("respects the limit", () => {
    expect(fileHotspots(seed(), 1)).toHaveLength(1);
  });
});
