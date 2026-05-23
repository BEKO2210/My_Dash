import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { errorStats, recentErrors } from "@/lib/errors";
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
