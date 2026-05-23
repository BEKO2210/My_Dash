import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { hourBucket, recentActivity } from "@/lib/activity";
import { migrate } from "@/lib/migrations";

describe("hourBucket", () => {
  it("reduces a SQLite or ISO timestamp to its hour", () => {
    expect(hourBucket("2026-05-23 21:34:05")).toBe("2026-05-23 21");
    expect(hourBucket("2026-05-23T21:34:05Z")).toBe("2026-05-23 21");
  });
});

describe("recentActivity", () => {
  let open: Database.Database | null = null;
  afterEach(() => {
    open?.close();
    open = null;
  });

  it("returns buckets newest first", () => {
    const db = (open = new Database(":memory:"));
    migrate(db);
    const ins = db.prepare("INSERT INTO activity_buckets (bucket, event_type, count) VALUES (?, ?, ?)");
    ins.run("2026-05-23 10", "PreToolUse", 5);
    ins.run("2026-05-23 11", "Stop", 2);

    const rows = recentActivity(db, 10);
    expect(rows).toHaveLength(2);
    expect(rows[0].bucket).toBe("2026-05-23 11"); // newest first
    expect(rows[1].count).toBe(5);
  });
});
