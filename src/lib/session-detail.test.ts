import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { migrate } from "@/lib/migrations";
import { sessionDetail } from "@/lib/session-detail";

let open: Database.Database | null = null;
afterEach(() => {
  open?.close();
  open = null;
});

function seed(): Database.Database {
  const db = (open = new Database(":memory:"));
  migrate(db);
  db.prepare(`INSERT INTO sessions (id, project_name, title) VALUES (?, ?, ?)`).run("s1", "alpha", "Do work");
  db.prepare(`INSERT INTO sessions (id, project_name) VALUES (?, ?)`).run("s2", "beta");
  const ev = db.prepare(`INSERT INTO events (session_id, event_type, payload_json) VALUES (?, ?, '{}')`);
  ev.run("s1", "SessionStart");
  ev.run("s1", "UserPromptSubmit");
  ev.run("s2", "SessionStart");
  const tc = db.prepare(`INSERT INTO tool_calls (session_id, tool_name, success) VALUES (?, ?, ?)`);
  tc.run("s1", "Read", 1);
  tc.run("s1", "Bash", 0);
  db.prepare(`INSERT INTO prompts (session_id, event_id, text, token_estimate) VALUES (?, ?, ?, ?)`).run(
    "s1",
    2,
    "first prompt",
    7,
  );
  return db;
}

describe("sessionDetail", () => {
  it("returns the session with scoped counts and recent rows", () => {
    const d = sessionDetail(seed(), "s1")!;
    expect(d.session.title).toBe("Do work");
    expect(d.eventCount).toBe(2);
    expect(d.toolCount).toBe(2);
    expect(d.failureCount).toBe(1);
    expect(d.events).toHaveLength(2);
    expect(d.tools).toHaveLength(2);
    expect(d.prompts.map((p) => p.text)).toEqual(["first prompt"]);
  });

  it("scopes data to the requested session", () => {
    const d = sessionDetail(seed(), "s2")!;
    expect(d.eventCount).toBe(1);
    expect(d.toolCount).toBe(0);
    expect(d.prompts).toHaveLength(0);
  });

  it("returns null for an unknown session", () => {
    expect(sessionDetail(seed(), "nope")).toBeNull();
  });
});
