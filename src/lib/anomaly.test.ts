import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { migrate } from "@/lib/migrations";
import { anomalyReport, compareMetric } from "@/lib/anomaly";

describe("compareMetric", () => {
  it("flags a meaningful rise above baseline", () => {
    const c = compareMetric(150, 100, 0.5);
    expect(c.deltaPct).toBeCloseTo(0.5);
    expect(c.anomalous).toBe(true);
  });

  it("does not flag small or downward changes", () => {
    expect(compareMetric(110, 100, 0.5).anomalous).toBe(false);
    expect(compareMetric(50, 100, 0.5).anomalous).toBe(false);
  });

  it("never flags when there is no baseline", () => {
    expect(compareMetric(500, 0).anomalous).toBe(false);
    expect(compareMetric(500, 0).deltaPct).toBe(0);
  });
});

describe("anomalyReport", () => {
  let open: Database.Database | null = null;
  afterEach(() => {
    open?.close();
    open = null;
  });

  it("compares recent latency p95 to the baseline window", () => {
    const db = (open = new Database(":memory:"));
    migrate(db);
    const now = new Date("2026-05-24T12:00:00Z");
    const tc = db.prepare(`INSERT INTO tool_calls (session_id, tool_name, duration_ms, success, created_at) VALUES (?, ?, ?, 1, ?)`);
    // baseline (~5 days ago): fast
    for (let i = 0; i < 20; i++) tc.run("s1", "Read", 100, "2026-05-19 12:00:00");
    // recent (1h ago): slow
    for (let i = 0; i < 20; i++) tc.run("s1", "Read", 400, "2026-05-24 11:00:00");

    const r = anomalyReport(db, now);
    expect(r.recentSamples).toBe(20);
    expect(r.baselineSamples).toBe(20);
    expect(r.latencyMs.recent).toBe(400);
    expect(r.latencyMs.baseline).toBe(100);
    expect(r.latencyMs.anomalous).toBe(true);
  });
});
