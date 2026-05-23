import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { migrate } from "@/lib/migrations";
import { projectReliability } from "@/lib/reliability";

let open: Database.Database | null = null;
afterEach(() => {
  open?.close();
  open = null;
});

function seed(): Database.Database {
  const db = (open = new Database(":memory:"));
  migrate(db);
  db.prepare(`INSERT INTO sessions (id, project_name) VALUES (?, ?)`).run("a1", "alpha");
  db.prepare(`INSERT INTO sessions (id, project_name) VALUES (?, ?)`).run("b1", "beta");
  db.prepare(`INSERT INTO sessions (id, project_name) VALUES (?, ?)`).run("u1", null);
  const tc = db.prepare(`INSERT INTO tool_calls (session_id, tool_name, success) VALUES (?, ?, ?)`);
  // alpha: 4 calls, 1 failure → 0.75
  tc.run("a1", "Read", 1);
  tc.run("a1", "Edit", 1);
  tc.run("a1", "Bash", 0);
  tc.run("a1", "Read", 1);
  // beta: 2 calls, all ok → 1.0
  tc.run("b1", "Read", 1);
  tc.run("b1", "Grep", 1);
  // unknown project: 1 failed call
  tc.run("u1", "Bash", 0);
  return db;
}

describe("projectReliability", () => {
  it("computes success rate per project, most active first", () => {
    const rows = projectReliability(seed());
    expect(rows.map((r) => r.project)).toEqual(["alpha", "beta", "(unknown)"]);
    const alpha = rows.find((r) => r.project === "alpha")!;
    expect(alpha.total).toBe(4);
    expect(alpha.failures).toBe(1);
    expect(alpha.successRate).toBeCloseTo(0.75);
  });

  it("labels null projects and reports a perfect rate", () => {
    const rows = projectReliability(seed());
    expect(rows.find((r) => r.project === "beta")!.successRate).toBe(1);
    expect(rows.find((r) => r.project === "(unknown)")!.successRate).toBe(0);
  });

  it("respects the limit", () => {
    expect(projectReliability(seed(), 1)).toHaveLength(1);
  });
});
