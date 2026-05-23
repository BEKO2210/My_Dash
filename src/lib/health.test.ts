import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { collectHealth } from "@/lib/health";
import { MIGRATIONS, migrate } from "@/lib/migrations";

let open: Database.Database | null = null;
const fresh = () => (open = new Database(":memory:"));

afterEach(() => {
  open?.close();
  open = null;
});

describe("collectHealth", () => {
  it("reports ok with schema version and row counts on a migrated db", () => {
    const db = fresh();
    migrate(db);
    db.prepare("INSERT INTO sessions (id) VALUES (?)").run("s1");
    db.prepare("INSERT INTO events (session_id, event_type, payload_json) VALUES (?, ?, ?)").run(
      "s1",
      "SessionStart",
      "{}",
    );

    const r = collectHealth(db, { version: "9.9.9", uptimeSec: 42, now: "2026-01-01T00:00:00Z" });
    expect(r).toEqual({
      ok: true,
      db: "ok",
      schemaVersion: MIGRATIONS.length,
      sessions: 1,
      events: 1,
      toolCalls: 0,
      version: "9.9.9",
      uptimeSec: 42,
      now: "2026-01-01T00:00:00Z",
    });
  });

  it("reports a db error (no counts) when the schema is missing", () => {
    const db = fresh(); // never migrated -> tables don't exist
    const r = collectHealth(db, { version: "1.0.0", uptimeSec: 1, now: "t" });
    expect(r).toEqual({ ok: false, db: "error", version: "1.0.0", uptimeSec: 1, now: "t" });
  });

  it("defaults now to the current time when omitted", () => {
    const db = fresh();
    migrate(db);
    const r = collectHealth(db, { version: "1.0.0", uptimeSec: 0 });
    expect(Number.isNaN(Date.parse(r.now))).toBe(false);
  });
});
