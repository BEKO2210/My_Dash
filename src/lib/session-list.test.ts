import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { migrate } from "@/lib/migrations";
import { markStaleSessions, sessionCards, type SessionCard } from "@/lib/session-list";

let open: Database.Database | null = null;
afterEach(() => {
  open?.close();
  open = null;
});

function freshDb(): Database.Database {
  const db = (open = new Database(":memory:"));
  migrate(db);
  return db;
}

describe("sessionCards", () => {
  it("returns per-session event/tool counts (0 when none), newest activity first", () => {
    const db = freshDb();
    db.prepare("INSERT INTO sessions (id, status, last_seen) VALUES ('a','active','2026-05-25 10:00:00')").run();
    db.prepare("INSERT INTO sessions (id, status, last_seen) VALUES ('b','active','2026-05-25 09:00:00')").run();
    const ev = db.prepare("INSERT INTO events (session_id, event_type, payload_json) VALUES (?, 'E', '{}')");
    ev.run("a");
    ev.run("a");
    ev.run("a");
    const tc = db.prepare("INSERT INTO tool_calls (session_id, tool_name) VALUES (?, 'Read')");
    tc.run("a");
    tc.run("a");
    tc.run("b");

    const cards = sessionCards(db, 100);
    const byId = Object.fromEntries(cards.map((c) => [c.id, c]));
    expect(byId.a.event_count).toBe(3);
    expect(byId.a.tool_count).toBe(2);
    expect(byId.b.event_count).toBe(0); // grouped LEFT JOIN → 0, not null
    expect(byId.b.tool_count).toBe(1);
    expect(cards.map((c) => c.id)).toEqual(["a", "b"]); // last_seen DESC
  });

  it("respects the row limit", () => {
    const db = freshDb();
    for (let i = 0; i < 5; i++) {
      db.prepare("INSERT INTO sessions (id, status, last_seen) VALUES (?, 'active', ?)").run(
        `s${i}`,
        `2026-05-25 1${i}:00:00`,
      );
    }
    expect(sessionCards(db, 2)).toHaveLength(2);
  });
});

describe("markStaleSessions", () => {
  const card = (over: Partial<SessionCard>): SessionCard => ({
    id: "x",
    project_path: null,
    project_name: null,
    title: null,
    status: "waiting",
    source: null,
    first_seen: "2026-05-25 10:00:00",
    last_seen: "2026-05-25 10:00:00",
    ended_at: null,
    token_input: 0,
    token_output: 0,
    token_cache: 0,
    cost_usd: 0,
    branch: null,
    git_commit: null,
    remote_url: null,
    transcript_path: null,
    machine: null,
    event_count: 0,
    tool_count: 0,
    ...over,
  });
  const cutoff = Date.parse("2026-05-25T12:00:00Z");

  it("marks a stale (old, non-ended) session as ended+stale", () => {
    const [s] = markStaleSessions([card({ last_seen: "2026-05-25 10:00:00", status: "waiting" })], cutoff);
    expect(s.status).toBe("ended");
    expect(s.stale).toBe(true);
  });

  it("leaves a recently-active session (last_seen at/after the cutoff) untouched", () => {
    const [s] = markStaleSessions([card({ last_seen: "2026-05-25 12:30:00", status: "active" })], cutoff);
    expect(s.status).toBe("active");
    expect(s.stale).toBeUndefined();
  });

  it("never re-touches an already-ended session", () => {
    const [s] = markStaleSessions([card({ last_seen: "2020-01-01 00:00:00", status: "ended" })], cutoff);
    expect(s.status).toBe("ended");
    expect(s.stale).toBeUndefined();
  });
});
