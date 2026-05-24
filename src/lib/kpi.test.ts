import { describe, expect, it } from "vitest";
import { countUpValue, easeOutCubic, errorTone, sparklinePoints } from "@/lib/kpi";

describe("easeOutCubic", () => {
  it("is clamped and monotonic from 0 to 1", () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(-1)).toBe(0); // clamped
    expect(easeOutCubic(2)).toBe(1); // clamped
    expect(easeOutCubic(0.5)).toBeCloseTo(0.875, 3);
  });
});

describe("countUpValue", () => {
  it("interpolates from start to end across progress", () => {
    expect(countUpValue(0, 100, 0)).toBe(0);
    expect(countUpValue(0, 100, 1)).toBe(100);
    expect(countUpValue(10, 20, 1)).toBe(20);
    expect(countUpValue(0, 100, 0.5)).toBeCloseTo(87.5, 3);
  });
});

describe("errorTone", () => {
  it("maps error rate to a traffic-light tone", () => {
    expect(errorTone(0)).toBe("text-emerald-400");
    expect(errorTone(0.049)).toBe("text-emerald-400");
    expect(errorTone(0.05)).toBe("text-amber-400");
    expect(errorTone(0.19)).toBe("text-amber-400");
    expect(errorTone(0.2)).toBe("text-red-400");
  });
});

describe("sparklinePoints", () => {
  it("returns null for fewer than two points", () => {
    expect(sparklinePoints([])).toBeNull();
    expect(sparklinePoints([5])).toBeNull();
  });

  it("maps values into the box, inverting y and normalising to the max", () => {
    // max=10 → first point at bottom (y=h), last at top (y=0).
    expect(sparklinePoints([0, 10], 100, 24)).toBe("0,24 100,0");
  });

  it("guards against an all-zero series (max floored at 1)", () => {
    expect(sparklinePoints([0, 0, 0], 100, 24)).toBe("0,24 50,24 100,24");
  });
});
