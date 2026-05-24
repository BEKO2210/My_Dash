import { describe, expect, it } from "vitest";
import { windowRange } from "@/lib/virtual";

describe("windowRange", () => {
  it("returns the visible slice plus overscan and matching padding", () => {
    // 1000 rows of 50px, 400px viewport scrolled to 5000px (row 100).
    const w = windowRange({ scrollTop: 5000, viewport: 400, rowHeight: 50, count: 1000, overscan: 5 });
    expect(w.start).toBe(95); // 100 - overscan
    expect(w.end).toBe(113); // 100 + ceil(400/50)=8 + overscan 5
    expect(w.padTop).toBe(95 * 50);
    expect(w.padBottom).toBe((1000 - 113) * 50);
  });

  it("clamps at the top", () => {
    const w = windowRange({ scrollTop: 0, viewport: 400, rowHeight: 50, count: 1000, overscan: 6 });
    expect(w.start).toBe(0);
    expect(w.padTop).toBe(0);
  });

  it("clamps at the bottom (end never exceeds count, padBottom >= 0)", () => {
    const w = windowRange({ scrollTop: 1_000_000, viewport: 400, rowHeight: 50, count: 1000 });
    expect(w.end).toBe(1000);
    expect(w.padBottom).toBe(0);
  });

  it("renders everything for degenerate inputs", () => {
    expect(windowRange({ scrollTop: 0, viewport: 0, rowHeight: 50, count: 10 })).toEqual({
      start: 0,
      end: 10,
      padTop: 0,
      padBottom: 0,
    });
    expect(windowRange({ scrollTop: 0, viewport: 400, rowHeight: 0, count: 10 }).end).toBe(10);
    expect(windowRange({ scrollTop: 0, viewport: 400, rowHeight: 50, count: 0 }).end).toBe(0);
  });
});
