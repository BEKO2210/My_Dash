import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { errorSeries, errorStats, recentErrors, toolCallDetail, topFailingTools } from "@/lib/errors";
import { migrate } from "@/lib/migrations";

let open: Database.Database | null = null;
afterEach(() => {
  open?.close();
  open = null;
});

// Insert a tool call (+ its tool_io) with the given success/error.
function call(db: Database.Database, tool: string, success: number, errorText: string | null) {
  const id = Number(
    db
      .prepare("INSERT INTO tool_calls (session_id, tool_name, success) VALUES ('s', ?, ?)")
      .run(tool, success).lastInsertRowid,
  );
  db.prepare(
    "INSERT INTO tool_io (tool_call_id, is_error, error_text) VALUES (?, ?, ?)",
  ).run(id, success === 0 ? 1 : 0, errorText);
  return id;
}

function seeded(): Database.Database {
  const db = (open = new Database(":memory:"));
  migrate(db);
  call(db, "Read", 1, null);
  call(db, "Bash", 0, "command not found");
  call(db, "Edit", 1, null);
  call(db, "Bash", 0, "permission denied");
  return db;
}

describe("errorStats", () => {
  it("computes total, failures and rate", () => {
    expect(errorStats(seeded())).toEqual({ toolCalls: 4, failures: 2, errorRate: 0.5 });
  });

  it("returns a zero rate with no tool calls", () => {
    const db = (open = new Database(":memory:"));
    migrate(db);
    expect(errorStats(db)).toEqual({ toolCalls: 0, failures: 0, errorRate: 0 });
  });
});

describe("recentErrors", () => {
  it("returns only failures with their message, newest first", () => {
    const list = recentErrors(seeded(), 10);
    expect(list).toHaveLength(2);
    expect(list[0].error_text).toBe("permission denied"); // newest first
    expect(list[1].error_text).toBe("command not found");
    expect(list.every((e) => e.tool_name === "Bash")).toBe(true);
  });

  it("respects the limit", () => {
    expect(recentErrors(seeded(), 1)).toHaveLength(1);
  });
});

function dated(): Database.Database {
  const db = (open = new Database(":memory:"));
  migrate(db);
  const ins = db.prepare(
    "INSERT INTO tool_calls (session_id, tool_name, success, created_at) VALUES ('s', ?, ?, ?)",
  );
  ins.run("Bash", 0, "2026-05-23 10:00:00");
  ins.run("Bash", 1, "2026-05-23 11:00:00");
  ins.run("Read", 0, "2026-05-22 10:00:00");
  ins.run("Read", 1, "2026-05-22 11:00:00");
  ins.run("Edit", 1, "2026-05-20 10:00:00");
  return db;
}

describe("errorSeries", () => {
  it("returns one filled entry per day, oldest first", () => {
    const series = errorSeries(dated(), 3, new Date("2026-05-23T12:00:00Z"));
    expect(series.map((p) => p.date)).toEqual(["2026-05-21", "2026-05-22", "2026-05-23"]);
    expect(series[0]).toEqual({ date: "2026-05-21", total: 0, failures: 0 }); // gap filled
    expect(series[1]).toEqual({ date: "2026-05-22", total: 2, failures: 1 });
    expect(series[2]).toEqual({ date: "2026-05-23", total: 2, failures: 1 });
  });
});

describe("topFailingTools", () => {
  it("ranks tools with failures by failure count, with rate", () => {
    const rows = topFailingTools(dated());
    expect(rows.map((r) => r.tool)).toEqual(["Bash", "Read"]); // Edit has no failures
    expect(rows[0]).toMatchObject({ tool: "Bash", failures: 1, total: 2, rate: 0.5 });
  });

  it("respects the since window", () => {
    const rows = topFailingTools(dated(), 6, "2026-05-23 00:00:00");
    expect(rows.map((r) => r.tool)).toEqual(["Bash"]); // only the 05-23 failure remains
  });
});

describe("toolCallDetail", () => {
  let open: Database.Database | null = null;
  afterEach(() => {
    open?.close();
    open = null;
  });

  it("returns the call with parsed I/O", () => {
    const db = (open = new Database(":memory:"));
    migrate(db);
    const info = db
      .prepare(`INSERT INTO tool_calls (session_id, tool_name, target, success) VALUES (?, ?, ?, 0)`)
      .run("s1", "Bash", "npm test");
    const id = Number(info.lastInsertRowid);
    db.prepare(
      `INSERT INTO tool_io (tool_call_id, input_json, output_json, is_error, error_text) VALUES (?, ?, ?, 1, ?)`,
    ).run(id, '{"command":"npm test"}', '{"code":1}', "exit 1");

    const detail = toolCallDetail(db, id)!;
    expect(detail.tool_name).toBe("Bash");
    expect(detail.input).toEqual({ command: "npm test" });
    expect(detail.output).toEqual({ code: 1 });
    expect(detail.error_text).toBe("exit 1");
  });

  it("returns null for an unknown id", () => {
    const db = (open = new Database(":memory:"));
    migrate(db);
    expect(toolCallDetail(db, 999)).toBeNull();
  });
});
