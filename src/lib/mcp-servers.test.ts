import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { migrate } from "@/lib/migrations";
import { mcpServerUsage } from "@/lib/mcp-servers";

let open: Database.Database | null = null;
afterEach(() => {
  open?.close();
  open = null;
});

function seed(): Database.Database {
  const db = (open = new Database(":memory:"));
  migrate(db);
  const ins = db.prepare(
    `INSERT INTO tool_calls (session_id, tool_name, duration_ms, success, source, mcp_server)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  // github: 3 calls, 1 failure, 2 distinct tools
  ins.run("s1", "create_pr", 100, 1, "mcp", "github");
  ins.run("s1", "create_pr", 300, 0, "mcp", "github");
  ins.run("s1", "list_issues", 200, 1, "mcp", "github");
  // notion: 1 call, no failures
  ins.run("s1", "search", 50, 1, "mcp", "notion");
  // builtin calls must be ignored
  ins.run("s1", "Read", 10, 1, "builtin", null);
  return db;
}

describe("mcpServerUsage", () => {
  it("aggregates per server, busiest first, ignoring builtin calls", () => {
    const rows = mcpServerUsage(seed());
    expect(rows.map((r) => r.server)).toEqual(["github", "notion"]);
    const gh = rows.find((r) => r.server === "github")!;
    expect(gh.calls).toBe(3);
    expect(gh.failures).toBe(1);
    expect(gh.errorRate).toBeCloseTo(1 / 3);
    expect(gh.tools).toBe(2);
    expect(gh.avgMs).toBe(200); // (100+300+200)/3
  });

  it("reports a zero error rate for a clean server", () => {
    const rows = mcpServerUsage(seed());
    expect(rows.find((r) => r.server === "notion")!.errorRate).toBe(0);
  });

  it("returns an empty array when there are no MCP calls", () => {
    const db = (open = new Database(":memory:"));
    migrate(db);
    expect(mcpServerUsage(db)).toEqual([]);
  });
});
