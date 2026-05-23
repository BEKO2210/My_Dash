import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { migrate } from "@/lib/migrations";
import {
  eventsPerSession,
  movingAverage,
  toolsPerMinute,
  trendDelta,
  velocitySeries,
  type VelocityDay,
} from "@/lib/velocity";

const day = (over: Partial<VelocityDay> = {}): VelocityDay => ({
  date: "2026-05-23",
  toolCalls: 0,
  events: 0,
  sessions: 0,
  activeMinutes: 0,
  ...over,
});

describe("ratios", () => {
  it("computes tools per minute and events per session, guarding divide-by-zero", () => {
    expect(toolsPerMinute(day({ toolCalls: 30, activeMinutes: 10 }))).toBe(3);
    expect(toolsPerMinute(day({ toolCalls: 5, activeMinutes: 0 }))).toBe(0);
    expect(eventsPerSession(day({ events: 20, sessions: 4 }))).toBe(5);
    expect(eventsPerSession(day({ events: 5, sessions: 0 }))).toBe(0);
  });
});

describe("movingAverage", () => {
  it("uses a trailing window, ramping up at the start", () => {
    expect(movingAverage([2, 4, 6, 8], 2)).toEqual([2, 3, 5, 7]);
  });
});

describe("trendDelta", () => {
  it("compares the last window mean to the prior window mean", () => {
    // prior [10,10] mean 10, recent [15,15] mean 15 → +0.5
    expect(trendDelta([10, 10, 15, 15], 2)).toBeCloseTo(0.5);
  });
  it("returns 0 without enough history", () => {
    expect(trendDelta([1, 2, 3], 2)).toBe(0);
  });
});

describe("velocitySeries", () => {
  let open: Database.Database | null = null;
  afterEach(() => {
    open?.close();
    open = null;
  });

  it("gathers per-day aggregates, gap-filled oldest first", () => {
    const db = (open = new Database(":memory:"));
    migrate(db);
    const now = new Date("2026-05-23T12:00:00Z");
    db.prepare(
      `INSERT INTO sessions (id, first_seen, last_seen) VALUES (?, ?, ?)`,
    ).run("s1", "2026-05-23 10:00:00", "2026-05-23 10:30:00");
    const tc = db.prepare(`INSERT INTO tool_calls (session_id, tool_name, created_at) VALUES (?, ?, ?)`);
    tc.run("s1", "Read", "2026-05-23 10:05:00");
    tc.run("s1", "Bash", "2026-05-23 10:06:00");
    db.prepare(
      `INSERT INTO events (session_id, event_type, payload_json, created_at) VALUES (?, ?, ?, ?)`,
    ).run("s1", "PostToolUse", "{}", "2026-05-23 10:05:00");

    const days = velocitySeries(db, 2, now);
    expect(days.map((d) => d.date)).toEqual(["2026-05-22", "2026-05-23"]);
    const today = days[1];
    expect(today.toolCalls).toBe(2);
    expect(today.sessions).toBe(1);
    expect(today.activeMinutes).toBe(30);
    expect(toolsPerMinute(today)).toBeCloseTo(2 / 30);
  });
});
