import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { migrate } from "@/lib/migrations";
import { projectUsage } from "@/lib/projects";

let open: Database.Database | null = null;
afterEach(() => {
  open?.close();
  open = null;
});

function seed(): Database.Database {
  const db = (open = new Database(":memory:"));
  migrate(db);
  const ins = db.prepare(
    `INSERT INTO sessions (id, project_name, cost_usd, token_input, token_output, token_cache)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  ins.run("a1", "A", 3, 100, 10, 0);
  ins.run("a2", "A", 2, 100, 10, 0);
  ins.run("b1", "B", 8, 50, 5, 5);
  ins.run("u1", null, 0, 0, 0, 0);
  const tc = db.prepare(`INSERT INTO tool_calls (session_id, tool_name) VALUES (?, ?)`);
  tc.run("a1", "Read");
  tc.run("a2", "Bash");
  tc.run("a2", "Edit");
  tc.run("b1", "Read");
  return db;
}

describe("projectUsage", () => {
  it("aggregates cost/tokens/sessions per project, sorted by cost", () => {
    const rows = projectUsage(seed());
    expect(rows.map((r) => r.project)).toEqual(["B", "A", "(unknown)"]);

    const a = rows.find((r) => r.project === "A")!;
    expect(a.sessions).toBe(2);
    expect(a.costUsd).toBe(5);
    expect(a.tokenInput).toBe(200);
    expect(a.totalTokens).toBe(220); // 200 + 20 + 0
    expect(a.tools).toBe(3); // 1 in a1 + 2 in a2
  });

  it("counts tool calls per project, zero when none", () => {
    const rows = projectUsage(seed());
    expect(rows.find((r) => r.project === "B")!.tools).toBe(1);
    expect(rows.find((r) => r.project === "(unknown)")!.tools).toBe(0);
  });

  it("groups null/empty project names under (unknown)", () => {
    const rows = projectUsage(seed());
    expect(rows.find((r) => r.project === "(unknown)")!.sessions).toBe(1);
  });

  it("respects the limit", () => {
    expect(projectUsage(seed(), 1)).toHaveLength(1);
  });
});
