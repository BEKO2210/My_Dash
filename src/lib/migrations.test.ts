import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { MIGRATIONS, migrate } from "@/lib/migrations";

let open: Database.Database | null = null;
const fresh = () => (open = new Database(":memory:"));
const version = (db: Database.Database) => db.pragma("user_version", { simple: true }) as number;
const tables = (db: Database.Database) =>
  (db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]).map(
    (r) => r.name,
  );

afterEach(() => {
  open?.close();
  open = null;
});

describe("migrate", () => {
  it("brings a fresh database to the latest version with all tables", () => {
    const db = fresh();
    expect(version(db)).toBe(0);
    expect(migrate(db)).toBe(MIGRATIONS.length);
    expect(version(db)).toBe(MIGRATIONS.length);
    expect(tables(db)).toEqual(
      expect.arrayContaining([
        "sessions",
        "events",
        "tool_calls",
        "tool_io",
        "session_links",
        "prompts",
        "file_edits",
      ]),
    );
  });

  it("adds the model column to events (v3)", () => {
    const db = fresh();
    migrate(db);
    const cols = (db.prepare("PRAGMA table_info(events)").all() as { name: string }[]).map(
      (c) => c.name,
    );
    expect(cols).toContain("model");
  });

  it("is idempotent — a second run is a no-op", () => {
    const db = fresh();
    migrate(db);
    const before = version(db);
    expect(() => migrate(db)).not.toThrow();
    expect(version(db)).toBe(before);
  });

  it("adopts a pre-existing v0 database (old inline-schema) without losing data", () => {
    const db = fresh();
    // Simulate a database created by the previous code: tables exist, but the
    // version was never stamped, so it sits at user_version 0.
    db.exec(MIGRATIONS[0]);
    expect(version(db)).toBe(0);
    db.prepare("INSERT INTO sessions (id) VALUES (?)").run("legacy");

    migrate(db);

    expect(version(db)).toBe(MIGRATIONS.length);
    expect(db.prepare("SELECT id FROM sessions WHERE id = ?").get("legacy")).toEqual({
      id: "legacy",
    });
  });

  it("leaves a database that is already current untouched", () => {
    const db = fresh();
    migrate(db);
    db.prepare("INSERT INTO sessions (id) VALUES (?)").run("keep");
    migrate(db);
    expect(db.prepare("SELECT COUNT(*) AS n FROM sessions").get()).toEqual({ n: 1 });
  });
});
