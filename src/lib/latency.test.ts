import { describe, expect, it } from "vitest";
import { formatMs, latencyStats, percentile } from "@/lib/latency";

describe("percentile", () => {
  const sorted = Array.from({ length: 100 }, (_, i) => i + 1); // 1..100
  it("computes nearest-rank percentiles", () => {
    expect(percentile(sorted, 50)).toBe(50);
    expect(percentile(sorted, 95)).toBe(95);
    expect(percentile(sorted, 99)).toBe(99);
  });
  it("returns 0 for an empty array", () => {
    expect(percentile([], 95)).toBe(0);
  });
});

describe("formatMs", () => {
  it("formats ms and seconds", () => {
    expect(formatMs(250)).toBe("250ms");
    expect(formatMs(1000)).toBe("1s");
    expect(formatMs(1500)).toBe("1.5s");
  });
});

describe("latencyStats", () => {
  it("counts, percentiles and buckets a distribution", () => {
    const values = [5, 8, 12, 30, 80, 200, 700, 3000, 20000];
    const s = latencyStats(values);
    expect(s.count).toBe(9);
    expect(s.max).toBe(20000);
    // 11 buckets (10 edges + overflow); counts sum to the input length.
    expect(s.buckets).toHaveLength(11);
    expect(s.buckets.reduce((a, b) => a + b.count, 0)).toBe(9);
    // First bucket "<10ms" holds 5 and 8.
    expect(s.buckets[0].count).toBe(2);
    // Overflow bucket holds the 20000ms outlier.
    expect(s.buckets[s.buckets.length - 1].count).toBe(1);
  });

  it("handles an empty input", () => {
    const s = latencyStats([]);
    expect(s).toMatchObject({ count: 0, p50: 0, p95: 0, p99: 0, max: 0 });
  });
});
