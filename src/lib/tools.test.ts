import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { migrate } from "@/lib/migrations";
import { toolFrequency } from "@/lib/tools";

let open: Database.Database | null = null;
afterEach(() => {
  open?.close();
  open = null;
});

function seed(): Database.Database {
  const db = (open = new Database(":memory:"));
  migrate(db);
  const ins = db.prepare(
    `INSERT INTO tool_calls (session_id, tool_name, success, duration_ms, source, mcp_server, created_at)
     VALUES ('s', ?, ?, ?, ?, ?, ?)`,
  );
  ins.run("Read", 1, 10, "builtin", null, "2026-05-23 10:00:00");
  ins.run("Read", 1, 30, "builtin", null, "2026-05-23 11:00:00");
  ins.run("Read", 0, null, "builtin", null, "2026-05-20 11:00:00");
  ins.run("Bash", 1, 100, "builtin", null, "2026-05-23 10:00:00");
  ins.run("mcp__github__pr", 0, 50, "mcp", "github", "2026-05-23 10:00:00");
  return db;
}

describe("toolFrequency", () => {
  it("ranks tools by count with failures, source and avg duration", () => {
    const rows = toolFrequency(seed());
    expect(rows.map((r) => r.tool)).toEqual(["Read", "Bash", "mcp__github__pr"]);
    const read = rows[0];
    expect(read.count).toBe(3);
    expect(read.failures).toBe(1);
    expect(read.source).toBe("builtin");
    expect(read.avgDurationMs).toBe(20); // avg(10,30) ignoring null
    const mcp = rows.find((r) => r.tool === "mcp__github__pr")!;
    expect(mcp.source).toBe("mcp");
    expect(mcp.mcpServer).toBe("github");
  });

  it("filters by the since window", () => {
    const rows = toolFrequency(seed(), 12, "2026-05-23 00:00:00");
    // The 2026-05-20 Read failure is excluded -> Read count 2, failures 0.
    const read = rows.find((r) => r.tool === "Read")!;
    expect(read.count).toBe(2);
    expect(read.failures).toBe(0);
  });

  it("respects the limit", () => {
    expect(toolFrequency(seed(), 1)).toHaveLength(1);
  });
});
