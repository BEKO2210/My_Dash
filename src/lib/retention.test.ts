import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { migrate } from "@/lib/migrations";
import { pruneAll, pruneTable, retentionLimit } from "@/lib/retention";

const ENV = { ...process.env };
let open: Database.Database | null = null;

afterEach(() => {
  open?.close();
  open = null;
  process.env = { ...ENV };
});

function dbWithEvents(n: number): Database.Database {
  const db = (open = new Database(":memory:"));
  migrate(db);
  const ins = db.prepare("INSERT INTO events (session_id, event_type, payload_json) VALUES ('s','E','{}')");
  for (let i = 0; i < n; i++) ins.run();
  return db;
}

const count = (db: Database.Database, t: string) =>
  (db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n;

describe("retentionLimit", () => {
  it("uses the fallback when unset", () => {
    delete process.env.MC_TEST_LIMIT;
    expect(retentionLimit("MC_TEST_LIMIT", 5)).toBe(5);
  });

  it("parses a valid value and truncates", () => {
    process.env.MC_TEST_LIMIT = "12.9";
    expect(retentionLimit("MC_TEST_LIMIT", 5)).toBe(12);
  });

  it("falls back on a non-numeric value", () => {
    process.env.MC_TEST_LIMIT = "abc";
    expect(retentionLimit("MC_TEST_LIMIT", 5)).toBe(5);
  });

  it("treats a negative value as disabled (0)", () => {
    process.env.MC_TEST_LIMIT = "-1";
    expect(retentionLimit("MC_TEST_LIMIT", 5)).toBe(0);
  });
});

describe("pruneTable", () => {
  it("keeps only the newest `max` rows", () => {
    const db = dbWithEvents(10);
    const removed = pruneTable(db, "events", 4);
    expect(removed).toBe(6);
    expect(count(db, "events")).toBe(4);
    // The survivors are the most recent ids (7..10).
    const ids = (db.prepare("SELECT id FROM events ORDER BY id").all() as { id: number }[]).map(
      (r) => r.id,
    );
    expect(ids).toEqual([7, 8, 9, 10]);
  });

  it("does nothing when the table is within the limit", () => {
    const db = dbWithEvents(3);
    expect(pruneTable(db, "events", 10)).toBe(0);
    expect(count(db, "events")).toBe(3);
  });

  it("is disabled when max <= 0", () => {
    const db = dbWithEvents(5);
    expect(pruneTable(db, "events", 0)).toBe(0);
    expect(count(db, "events")).toBe(5);
  });
});

describe("pruneAll", () => {
  it("honours the per-table env limits", () => {
    const db = dbWithEvents(8);
    process.env.MC_MAX_EVENTS = "3";
    const { events } = pruneAll(db);
    expect(events).toBe(5);
    expect(count(db, "events")).toBe(3);
  });

  it("drops tool_io and file_edits rows orphaned by tool_calls pruning", () => {
    const db = (open = new Database(":memory:"));
    migrate(db);
    const insCall = db.prepare("INSERT INTO tool_calls (session_id, tool_name) VALUES ('s','Edit')");
    const insIo = db.prepare("INSERT INTO tool_io (tool_call_id) VALUES (?)");
    const insFe = db.prepare("INSERT INTO file_edits (session_id, tool_call_id, path) VALUES ('s', ?, '/x')");
    for (let i = 0; i < 6; i++) {
      const id = Number(insCall.run().lastInsertRowid);
      insIo.run(id);
      insFe.run(id);
    }

    process.env.MC_MAX_TOOL_CALLS = "2";
    const { toolCalls, toolIo, fileEdits } = pruneAll(db);
    expect(toolCalls).toBe(4);
    expect(toolIo).toBe(4);
    expect(fileEdits).toBe(4);
    expect(count(db, "tool_io")).toBe(2);
    expect(count(db, "file_edits")).toBe(2);
  });
});
