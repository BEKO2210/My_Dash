import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { buildCalendar, dailyActivity, type CalDayCount } from "@/lib/calendar";
import { migrate } from "@/lib/migrations";

describe("buildCalendar", () => {
  it("pads the leading week to the first day's weekday (Mon-first)", () => {
    // 2026-05-20 is a Wednesday → weekday index 2 (Mon=0).
    const series: CalDayCount[] = [
      { date: "2026-05-20", count: 0 },
      { date: "2026-05-21", count: 2 },
      { date: "2026-05-22", count: 5 },
    ];
    const cal = buildCalendar(series);
    expect(cal.weeks).toHaveLength(1);
    expect(cal.weeks[0][0]).toBeNull();
    expect(cal.weeks[0][1]).toBeNull();
    expect(cal.weeks[0][2]?.date).toBe("2026-05-20");
    expect(cal.weeks[0][4]?.date).toBe("2026-05-22");
    expect(cal.weeks[0][5]).toBeNull();
    expect(cal.total).toBe(7);
    expect(cal.max).toBe(5);
    expect(cal.months[0].month).toBe(4); // May (0-indexed)
  });

  it("starts a fresh column every 7 days with no padding on a Monday start", () => {
    // 2026-05-18 is a Monday.
    const series: CalDayCount[] = Array.from({ length: 14 }, (_, i) => ({
      date: new Date(Date.UTC(2026, 4, 18 + i)).toISOString().slice(0, 10),
      count: i,
    }));
    const cal = buildCalendar(series);
    expect(cal.weeks).toHaveLength(2);
    expect(cal.weeks[0][0]?.date).toBe("2026-05-18");
    expect(cal.weeks[1][0]?.date).toBe("2026-05-25");
  });

  it("returns an empty calendar for no data", () => {
    expect(buildCalendar([])).toEqual({ weeks: [], months: [], total: 0, max: 0 });
  });
});

describe("dailyActivity", () => {
  let open: Database.Database | null = null;
  afterEach(() => {
    open?.close();
    open = null;
  });

  it("folds hour buckets into per-day counts, gap-filled", () => {
    const db = (open = new Database(":memory:"));
    migrate(db);
    const now = new Date("2026-05-23T12:00:00Z");
    const ins = db.prepare(
      `INSERT INTO activity_buckets (bucket, event_type, count) VALUES (?, ?, ?)`,
    );
    ins.run("2026-05-23 09", "PreToolUse", 3);
    ins.run("2026-05-23 10", "PostToolUse", 2);
    ins.run("2026-05-21 08", "SessionStart", 1);

    const days = dailyActivity(db, 3, now);
    expect(days.map((d) => d.date)).toEqual(["2026-05-21", "2026-05-22", "2026-05-23"]);
    expect(days.map((d) => d.count)).toEqual([1, 0, 5]);
  });
});
