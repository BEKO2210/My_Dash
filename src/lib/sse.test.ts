import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { migrate } from "@/lib/migrations";
import { eventsSince, parseLastEventId, sseFrame } from "@/lib/sse";

describe("parseLastEventId", () => {
  it("returns null for missing or invalid values", () => {
    expect(parseLastEventId(null)).toBeNull();
    expect(parseLastEventId("")).toBeNull();
    expect(parseLastEventId("abc")).toBeNull();
    expect(parseLastEventId("0")).toBeNull();
    expect(parseLastEventId("-5")).toBeNull();
    expect(parseLastEventId("1.5")).toBeNull();
  });

  it("parses a positive integer id", () => {
    expect(parseLastEventId("42")).toBe(42);
  });
});

describe("sseFrame", () => {
  it("includes an id line when given an id", () => {
    expect(sseFrame(7, { a: 1 })).toBe('id: 7\ndata: {"a":1}\n\n');
  });

  it("omits the id line when id is null", () => {
    expect(sseFrame(null, { a: 1 })).toBe('data: {"a":1}\n\n');
  });
});

describe("eventsSince", () => {
  let open: Database.Database | null = null;
  afterEach(() => {
    open?.close();
    open = null;
  });

  it("returns only events newer than the given id, oldest first, capped", () => {
    const db = (open = new Database(":memory:"));
    migrate(db);
    const ins = db.prepare("INSERT INTO events (session_id, event_type, payload_json) VALUES ('s','E','{}')");
    for (let i = 0; i < 5; i++) ins.run(); // ids 1..5

    const rows = eventsSince(db, 2, 10);
    expect(rows.map((r) => r.id)).toEqual([3, 4, 5]);

    expect(eventsSince(db, 2, 2).map((r) => r.id)).toEqual([3, 4]); // limit respected
    expect(eventsSince(db, 5, 10)).toEqual([]); // nothing newer
  });
});
