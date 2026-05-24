import { describe, expect, it } from "vitest";
import { inQuietHours, isCritical, isSuppressed } from "@/lib/quiet";

const at = (h: number, m = 0) => new Date(2026, 4, 24, h, m, 0);

describe("inQuietHours", () => {
  it("handles a same-day window", () => {
    expect(inQuietHours("09:00", "17:00", at(12))).toBe(true);
    expect(inQuietHours("09:00", "17:00", at(18))).toBe(false);
  });

  it("handles an overnight window", () => {
    expect(inQuietHours("22:00", "07:00", at(23))).toBe(true);
    expect(inQuietHours("22:00", "07:00", at(3))).toBe(true);
    expect(inQuietHours("22:00", "07:00", at(12))).toBe(false);
  });

  it("is never quiet for empty/equal/invalid windows", () => {
    expect(inQuietHours("08:00", "08:00", at(8))).toBe(false);
    expect(inQuietHours("", "07:00", at(3))).toBe(false);
    expect(inQuietHours("25:00", "07:00", at(3))).toBe(false);
  });
});

describe("isCritical", () => {
  it("marks error spikes and cost projections critical", () => {
    expect(isCritical("error_spike")).toBe(true);
    expect(isCritical("cost_projection")).toBe(true);
    expect(isCritical("mcp_error")).toBe(false);
    expect(isCritical("session_long")).toBe(false);
  });
});

describe("isSuppressed", () => {
  const cfg = { enabled: true, start: "22:00", end: "07:00" };
  it("suppresses non-critical alerts during quiet hours only", () => {
    expect(isSuppressed("session_long", cfg, at(23))).toBe(true);
    expect(isSuppressed("session_long", cfg, at(12))).toBe(false);
    expect(isSuppressed("error_spike", cfg, at(23))).toBe(false); // critical → never suppressed
    expect(isSuppressed("session_long", { ...cfg, enabled: false }, at(23))).toBe(false);
  });
});
