import { describe, expect, it } from "vitest";
import { foldHeatmap, level } from "@/lib/heatmap";
import type { ActivityBucket } from "@/lib/activity";

const b = (bucket: string, count: number, event_type = "E"): ActivityBucket => ({
  bucket,
  event_type,
  count,
});

describe("foldHeatmap", () => {
  it("produces a 7x24 grid and sums counts into the local weekday/hour cell", () => {
    const bucket = "2026-05-20 14"; // a Wednesday (UTC)
    const { grid, total } = foldHeatmap([b(bucket, 3), b(bucket, 2, "PostToolUse")]);
    expect(grid).toHaveLength(7);
    expect(grid[0]).toHaveLength(24);
    expect(total).toBe(5);

    // Same accumulation rule the widget uses, so it's TZ-independent.
    const d = new Date(`${bucket.replace(" ", "T")}:00:00Z`);
    expect(grid[(d.getDay() + 6) % 7][d.getHours()]).toBe(5);
  });

  it("computes max and p95 over the cells", () => {
    const { max, p95 } = foldHeatmap([b("2026-05-20 10", 10), b("2026-05-21 11", 2)]);
    expect(max).toBe(10);
    expect(p95).toBeGreaterThan(0);
  });

  it("ignores malformed buckets", () => {
    expect(foldHeatmap([b("not-a-date", 5)]).total).toBe(0);
  });
});

describe("level", () => {
  it("returns 0 for no activity and 1..4 scaled to the clamp", () => {
    expect(level(0, 10)).toBe(0);
    expect(level(10, 10)).toBe(4);
    expect(level(20, 10)).toBe(4); // clamped
    expect(level(1, 10)).toBe(1);
    expect(level(5, 10)).toBe(2);
  });

  it("returns 1 for any positive count when clamp is 0", () => {
    expect(level(3, 0)).toBe(1);
  });
});
