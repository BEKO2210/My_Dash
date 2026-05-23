import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { migrate } from "@/lib/migrations";
import { durationStats, sessionDurationsMs } from "@/lib/session-duration";

const MIN = 60_000;

describe("durationStats", () => {
  it("buckets durations, summing to the input length", () => {
    const values = [30_000, 90_000, 10 * MIN, 45 * MIN, 3 * 60 * MIN]; // 30s, 1.5m, 10m, 45m, 3h
    const s = durationStats(values);
    expect(s.count).toBe(5);
    expect(s.buckets).toHaveLength(8); // 7 edges + overflow
    expect(s.buckets.reduce((a, b) => a + b.count, 0)).toBe(5);
    expect(s.buckets[0].count).toBe(1); // <1m → the 30s session
    expect(s.max).toBe(3 * 60 * MIN);
  });

  it("computes median and p95", () => {
    const values = Array.from({ length: 100 }, (_, i) => (i + 1) * MIN); // 1..100 minutes
    const s = durationStats(values);
    expect(s.median).toBe(50 * MIN);
    expect(s.p95).toBe(95 * MIN);
  });

  it("handles an empty input", () => {
    expect(durationStats([])).toMatchObject({ count: 0, median: 0, p95: 0, max: 0 });
  });
});

describe("sessionDurationsMs", () => {
  let open: Database.Database | null = null;
  afterEach(() => {
    open?.close();
    open = null;
  });

  it("returns positive per-session spans only", () => {
    const db = (open = new Database(":memory:"));
    migrate(db);
    const ins = db.prepare(`INSERT INTO sessions (id, first_seen, last_seen) VALUES (?, ?, ?)`);
    ins.run("s1", "2026-05-23 10:00:00", "2026-05-23 10:30:00"); // 30 min
    ins.run("s2", "2026-05-23 11:00:00", "2026-05-23 11:00:00"); // zero → dropped
    const ms = sessionDurationsMs(db);
    expect(ms).toHaveLength(1);
    expect(ms[0]).toBe(30 * MIN);
  });
});
