import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { migrate } from "@/lib/migrations";
import { toolTokenBurn } from "@/lib/token-burn";

let open: Database.Database | null = null;
afterEach(() => {
  open?.close();
  open = null;
});

function seed(): Database.Database {
  const db = (open = new Database(":memory:"));
  migrate(db);
  const tc = db.prepare(`INSERT INTO tool_calls (session_id, tool_name) VALUES (?, ?)`);
  const io = db.prepare(
    `INSERT INTO tool_io (tool_call_id, input_json, output_json, is_error) VALUES (?, ?, ?, 0)`,
  );
  // Read: small input, large output (8 + 400 chars => 102 tokens)
  const r1 = tc.run("s1", "Read");
  io.run(Number(r1.lastInsertRowid), "x".repeat(8), "y".repeat(400));
  // Bash: medium (40 + 40 => 20 tokens)
  const r2 = tc.run("s1", "Bash");
  io.run(Number(r2.lastInsertRowid), "z".repeat(40), "w".repeat(40));
  // Grep: a call with no I/O row at all (0 tokens)
  tc.run("s1", "Grep");
  return db;
}

describe("toolTokenBurn", () => {
  it("estimates tokens from I/O size, biggest first, with shares", () => {
    const tools = toolTokenBurn(seed());
    expect(tools[0].tool).toBe("Read");
    expect(tools[0].tokens).toBe(102); // ceil(408/4)
    const bash = tools.find((t) => t.tool === "Bash")!;
    expect(bash.tokens).toBe(20); // ceil(80/4)
    // Shares sum to ~1 across the returned (here all) tools.
    const sum = tools.reduce((a, t) => a + t.share, 0);
    expect(sum).toBeCloseTo(1);
  });

  it("counts calls and tolerates missing I/O", () => {
    const tools = toolTokenBurn(seed());
    const grep = tools.find((t) => t.tool === "Grep")!;
    expect(grep.calls).toBe(1);
    expect(grep.tokens).toBe(0);
  });

  it("respects the limit", () => {
    expect(toolTokenBurn(seed(), 1)).toHaveLength(1);
  });
});
