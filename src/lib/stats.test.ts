import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { migrate } from "@/lib/migrations";
import { collectStats } from "@/lib/stats";

let open: Database.Database | null = null;
afterEach(() => {
  open?.close();
  open = null;
});

const NOW = new Date("2026-05-23T12:00:00Z");

describe("collectStats", () => {
  it("counts active sessions, today's events, tool calls and error rate", () => {
    const db = (open = new Database(":memory:"));
    migrate(db);
    db.prepare("INSERT INTO sessions (id, status) VALUES ('s1','active')").run();
    db.prepare("INSERT INTO sessions (id, status) VALUES ('s2','waiting')").run();
    db.prepare("INSERT INTO sessions (id, status) VALUES ('s3','ended')").run();
    const ev = db.prepare("INSERT INTO events (session_id, event_type, payload_json, created_at) VALUES ('s1','E','{}',?)");
    ev.run("2026-05-23 09:00:00");
    ev.run("2026-05-23 10:00:00");
    ev.run("2026-05-22 10:00:00"); // yesterday
    const tc = db.prepare("INSERT INTO tool_calls (session_id, tool_name, success, created_at) VALUES ('s1','Read',?,?)");
    tc.run(1, "2026-05-23 09:00:00");
    tc.run(0, "2026-05-23 10:00:00");

    const s = collectStats(db, NOW);
    expect(s.activeSessions).toBe(2); // active + waiting, not ended
    expect(s.eventsToday).toBe(2);
    expect(s.toolCallsToday).toBe(2);
    expect(s.errorRate).toBe(0.5);
    expect(s.sparkline).toHaveLength(24);
  });

  it("builds a 24-slot sparkline from the activity rollup", () => {
    const db = (open = new Database(":memory:"));
    migrate(db);
    // NOW is 12:00Z, so the current-hour bucket key is "2026-05-23 12".
    db.prepare("INSERT INTO activity_buckets (bucket, event_type, count) VALUES ('2026-05-23 12','E',7)").run();
    const s = collectStats(db, NOW);
    expect(s.sparkline).toHaveLength(24);
    expect(s.sparkline[23]).toBe(7); // current hour (last slot)
    expect(s.sparkline.reduce((a, b) => a + b, 0)).toBe(7);
  });
});
