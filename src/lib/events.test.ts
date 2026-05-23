import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { eventById, withParsedPayload } from "@/lib/events";
import { migrate } from "@/lib/migrations";
import type { EventRow } from "@/lib/types";

function row(over: Partial<EventRow> = {}): EventRow {
  return {
    id: 1,
    session_id: "s1",
    event_type: "PreToolUse",
    tool_name: "Read",
    summary: "Read: /x.ts",
    payload_json: '{"tool_name":"Read","tool_input":{"file_path":"/x.ts"}}',
    created_at: "2026-05-23 10:00:00",
    ...over,
  };
}

describe("withParsedPayload", () => {
  it("parses payload_json into payload and drops the raw string", () => {
    const detail = withParsedPayload(row());
    expect(detail.payload).toEqual({ tool_name: "Read", tool_input: { file_path: "/x.ts" } });
    expect("payload_json" in detail).toBe(false);
    expect(detail.id).toBe(1);
    expect(detail.event_type).toBe("PreToolUse");
  });

  it("tolerates a corrupt payload by yielding null", () => {
    expect(withParsedPayload(row({ payload_json: "not json" })).payload).toBeNull();
  });
});

describe("eventById", () => {
  let open: Database.Database | null = null;
  afterEach(() => {
    open?.close();
    open = null;
  });

  it("fetches a stored event by id and returns undefined when missing", () => {
    const db = (open = new Database(":memory:"));
    migrate(db);
    const info = db
      .prepare("INSERT INTO events (session_id, event_type, payload_json) VALUES (?, ?, ?)")
      .run("s1", "SessionStart", '{"source":"startup"}');
    const id = Number(info.lastInsertRowid);

    const found = eventById(db, id);
    expect(found?.event_type).toBe("SessionStart");
    expect(withParsedPayload(found!).payload).toEqual({ source: "startup" });

    expect(eventById(db, 99999)).toBeUndefined();
  });
});
