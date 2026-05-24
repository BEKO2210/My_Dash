import { describe, expect, it } from "vitest";
import { isTimeRange, rangeSinceIso, rangeToDays, TIME_RANGES } from "@/lib/time-range";

describe("isTimeRange", () => {
  it("accepts known ranges and rejects others", () => {
    for (const r of TIME_RANGES) expect(isTimeRange(r)).toBe(true);
    expect(isTimeRange("1h")).toBe(false);
    expect(isTimeRange(7)).toBe(false);
    expect(isTimeRange(null)).toBe(false);
  });
});

describe("rangeToDays", () => {
  it("maps each range to a day count", () => {
    expect(rangeToDays("24h")).toBe(1);
    expect(rangeToDays("7d")).toBe(7);
    expect(rangeToDays("30d")).toBe(30);
    expect(rangeToDays("90d")).toBe(90);
    expect(rangeToDays("all")).toBe(3650);
  });
});

describe("rangeSinceIso", () => {
  const now = new Date("2026-05-24T12:00:00Z");

  it("returns null for all", () => {
    expect(rangeSinceIso("all", now)).toBeNull();
  });

  it("subtracts the window as a SQLite-style UTC timestamp", () => {
    expect(rangeSinceIso("7d", now)).toBe("2026-05-17 12:00:00");
    expect(rangeSinceIso("24h", now)).toBe("2026-05-23 12:00:00");
  });
});
