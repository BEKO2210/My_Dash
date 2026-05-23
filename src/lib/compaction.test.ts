import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { parseCompaction, recentCompactions } from "@/lib/compaction";
import { migrate } from "@/lib/migrations";
import type { EventRow } from "@/lib/types";

function event(over: Partial<EventRow> = {}): EventRow {
  return {
    id: 1,
    session_id: "s1",
    event_type: "PreCompact",
    tool_name: null,
    model: null,
    summary: "compacting",
    payload_json: "{}",
    created_at: "2026-05-23 10:00:00",
    ...over,
  };
}

describe("parseCompaction", () => {
  it("extracts the trigger and custom instructions from the payload", () => {
    const c = parseCompaction(
      event({ payload_json: '{"trigger":"manual","custom_instructions":"keep the plan"}' }),
    );
    expect(c.trigger).toBe("manual");
    expect(c.customInstructions).toBe("keep the plan");
  });

  it("defaults the trigger to auto and tolerates a bad payload", () => {
    expect(parseCompaction(event({ payload_json: "{}" })).trigger).toBe("auto");
    expect(parseCompaction(event({ payload_json: "not json" })).trigger).toBe("auto");
    expect(parseCompaction(event()).customInstructions).toBeNull();
  });
});

describe("recentCompactions", () => {
  let open: Database.Database | null = null;
  afterEach(() => {
    open?.close();
    open = null;
  });

  it("returns only PreCompact events, newest first, parsed", () => {
    const db = (open = new Database(":memory:"));
    migrate(db);
    const ins = db.prepare(
      "INSERT INTO events (session_id, event_type, payload_json) VALUES (?, ?, ?)",
    );
    ins.run("s1", "PreCompact", '{"trigger":"auto"}');
    ins.run("s1", "PostToolUse", "{}");
    ins.run("s2", "PreCompact", '{"trigger":"manual"}');

    const list = recentCompactions(db, 10);
    expect(list).toHaveLength(2);
    expect(list[0].trigger).toBe("manual"); // newest first
    expect(list[1].trigger).toBe("auto");
  });
});
