import { describe, expect, it } from "vitest";
import { hourHistogram, peakHour, streakStats, type DayCount } from "@/lib/streak";
import type { ActivityBucket } from "@/lib/activity";

const day = (date: string, count: number): DayCount => ({ date, count });

describe("streakStats", () => {
  it("counts the current streak back from today", () => {
    const days = [day("2026-05-19", 1), day("2026-05-20", 0), day("2026-05-21", 2), day("2026-05-22", 1), day("2026-05-23", 3)];
    const s = streakStats(days);
    expect(s.current).toBe(3); // 21,22,23
    expect(s.longest).toBe(3);
    expect(s.activeDays).toBe(4);
    expect(s.totalSessions).toBe(7);
  });

  it("reports a current streak of 0 when today is inactive", () => {
    const days = [day("2026-05-21", 5), day("2026-05-22", 2), day("2026-05-23", 0)];
    const s = streakStats(days);
    expect(s.current).toBe(0);
    expect(s.longest).toBe(2);
  });

  it("handles an all-zero series", () => {
    expect(streakStats([day("2026-05-22", 0), day("2026-05-23", 0)])).toEqual({
      current: 0,
      longest: 0,
      activeDays: 0,
      totalSessions: 0,
    });
  });
});

describe("hourHistogram + peakHour", () => {
  const b = (bucket: string, count: number): ActivityBucket => ({ bucket, event_type: "x", count });

  it("buckets counts into 24 local hours and finds the peak", () => {
    // 2026-05-23 09:00 UTC — fold uses local hours; assert via the produced index.
    const hours = hourHistogram([b("2026-05-23 09", 3), b("2026-05-23 09", 2), b("2026-05-22 14", 1)]);
    expect(hours).toHaveLength(24);
    expect(hours.reduce((a, c) => a + c, 0)).toBe(6);
    const peak = peakHour(hours);
    expect(hours[peak]).toBe(5); // the doubled 09:00-UTC slot dominates
  });

  it("returns -1 for the peak when there is no activity", () => {
    expect(peakHour(new Array(24).fill(0))).toBe(-1);
  });
});
