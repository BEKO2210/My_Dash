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

  // #8 — the standalone FTS index must not keep rows for pruned events/prompts,
  // or search returns hits whose ref_id points at deleted records.
  it("removes search_fts rows orphaned by event pruning, leaving no stale ref_id", () => {
    const db = (open = new Database(":memory:"));
    migrate(db);
    const insEv = db.prepare("INSERT INTO events (session_id, event_type, payload_json) VALUES ('s','E','{}')");
    const insFts = db.prepare("INSERT INTO search_fts (text, kind, ref_id, session_id) VALUES ('hello', 'event', ?, 's')");
    for (let i = 0; i < 4; i++) insFts.run(Number(insEv.run().lastInsertRowid));

    process.env.MC_MAX_EVENTS = "1"; // keep newest event only → 3 pruned
    const { searchFts } = pruneAll(db);
    expect(searchFts).toBe(3);
    expect(count(db, "search_fts")).toBe(1);
    const stale = (
      db
        .prepare("SELECT COUNT(*) AS n FROM search_fts WHERE kind='event' AND ref_id NOT IN (SELECT id FROM events)")
        .get() as { n: number }
    ).n;
    expect(stale).toBe(0);
  });

  // #9 — prompts are bounded to retained events; FTS 'prompt' rows follow.
  it("removes prompts (and their FTS rows) orphaned by event pruning", () => {
    const db = (open = new Database(":memory:"));
    migrate(db);
    const insEv = db.prepare("INSERT INTO events (session_id, event_type, payload_json) VALUES ('s','UserPromptSubmit','{}')");
    const insPr = db.prepare("INSERT INTO prompts (session_id, event_id, text) VALUES ('s', ?, 'hi')");
    const insFts = db.prepare("INSERT INTO search_fts (text, kind, ref_id, session_id) VALUES ('hi', 'prompt', ?, 's')");
    for (let i = 0; i < 5; i++) {
      insEv.run();
      insFts.run(Number(insPr.run(i + 1).lastInsertRowid));
    }

    process.env.MC_MAX_EVENTS = "2"; // 3 events pruned → 3 prompts orphaned
    const { prompts, searchFts } = pruneAll(db);
    expect(prompts).toBe(3);
    expect(count(db, "prompts")).toBe(2);
    expect(searchFts).toBe(3); // the 3 orphaned 'prompt' FTS rows
  });

  // #9 — subagent links must not outlive the tool_call they hang off; links with
  // no tool_call_id (reserved for future correlation) are preserved.
  it("removes session_links orphaned by tool_call pruning, keeping null-link rows", () => {
    const db = (open = new Database(":memory:"));
    migrate(db);
    const insCall = db.prepare("INSERT INTO tool_calls (session_id, tool_name) VALUES ('s','Task')");
    const insLink = db.prepare("INSERT INTO session_links (parent_session_id, tool_call_id, kind) VALUES ('s', ?, 'subagent')");
    for (let i = 0; i < 5; i++) insLink.run(Number(insCall.run().lastInsertRowid));
    db.prepare("INSERT INTO session_links (parent_session_id, tool_call_id, kind) VALUES ('s', NULL, 'subagent')").run();

    process.env.MC_MAX_TOOL_CALLS = "2"; // 3 calls pruned → 3 links orphaned
    const { sessionLinks } = pruneAll(db);
    expect(sessionLinks).toBe(3);
    expect(count(db, "session_links")).toBe(3); // 2 still-linked + 1 null-link kept
  });

  // #10 — the optional OTLP receiver tables are capped by count (own env limits).
  it("caps otlp_metric and otlp_log by count", () => {
    const db = (open = new Database(":memory:"));
    migrate(db);
    const insM = db.prepare("INSERT INTO otlp_metric (name, value) VALUES ('m', 1)");
    const insL = db.prepare("INSERT INTO otlp_log (name) VALUES ('l')");
    for (let i = 0; i < 6; i++) {
      insM.run();
      insL.run();
    }

    process.env.MC_MAX_OTLP_METRICS = "2";
    process.env.MC_MAX_OTLP_LOGS = "3";
    const { otlpMetric, otlpLog } = pruneAll(db);
    expect(otlpMetric).toBe(4);
    expect(otlpLog).toBe(3);
    expect(count(db, "otlp_metric")).toBe(2);
    expect(count(db, "otlp_log")).toBe(3);
  });

  // #16 — the alert inbox is capped too (deduped, so a small default).
  it("caps the alerts table by count", () => {
    const db = (open = new Database(":memory:"));
    migrate(db);
    const insA = db.prepare("INSERT INTO alerts (type, message) VALUES ('t','m')");
    for (let i = 0; i < 7; i++) insA.run();

    process.env.MC_MAX_ALERTS = "3";
    const { alerts } = pruneAll(db);
    expect(alerts).toBe(4);
    expect(count(db, "alerts")).toBe(3);
  });
});
