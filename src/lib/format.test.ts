import { describe, it, expect, vi, afterEach } from "vitest";
import {
  parseDbTime,
  relativeTime,
  formatCompact,
  formatMoney,
  eventKind,
} from "@/lib/format";

describe("parseDbTime", () => {
  it("returns null for empty input", () => {
    expect(parseDbTime(null)).toBeNull();
    expect(parseDbTime(undefined)).toBeNull();
    expect(parseDbTime("")).toBeNull();
  });

  it("treats a space-separated SQLite timestamp as UTC", () => {
    const d = parseDbTime("2026-05-23 10:00:00");
    expect(d).toBeInstanceOf(Date);
    expect(d?.toISOString()).toBe("2026-05-23T10:00:00.000Z");
  });

  it("accepts an ISO string unchanged", () => {
    const d = parseDbTime("2026-05-23T10:00:00Z");
    expect(d?.toISOString()).toBe("2026-05-23T10:00:00.000Z");
  });

  it("returns null for an unparseable value", () => {
    expect(parseDbTime("not-a-date")).toBeNull();
  });
});

describe("relativeTime", () => {
  afterEach(() => vi.useRealTimers());

  it("returns an em dash for missing input", () => {
    expect(relativeTime(null)).toBe("—");
  });

  it("formats recent times in German by default", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-23T10:00:30Z"));
    expect(relativeTime("2026-05-23 10:00:00")).toBe("vor 30s");
  });

  it("formats minutes/hours/days in English", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-23T12:00:00Z"));
    expect(relativeTime("2026-05-23 10:00:00", "en")).toBe("2h ago");
    expect(relativeTime("2026-05-21 12:00:00", "en")).toBe("2d ago");
  });

  it("says 'just now' for sub-5-second deltas", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-23T10:00:02Z"));
    expect(relativeTime("2026-05-23 10:00:00", "en")).toBe("just now");
  });
});

describe("formatCompact", () => {
  it("compacts thousands and millions", () => {
    expect(formatCompact(950)).toBe("950");
    expect(formatCompact(1500)).toBe("1.5k");
    expect(formatCompact(2_000_000)).toBe("2M");
  });

  it("falls back to 0 for non-finite input", () => {
    expect(formatCompact(NaN)).toBe("0");
    expect(formatCompact(Infinity)).toBe("0");
  });
});

describe("formatMoney", () => {
  it("prefixes the right currency symbol with two decimals", () => {
    expect(formatMoney(12.5, "USD")).toBe("$12.50");
    expect(formatMoney(12.5, "EUR")).toBe("€12.50");
  });

  it("coerces non-finite amounts to 0", () => {
    expect(formatMoney(NaN, "EUR")).toBe("€0.00");
  });
});

describe("eventKind", () => {
  it("maps known hook event types", () => {
    expect(eventKind("SessionStart")).toBe("session-start");
    expect(eventKind("PreToolUse")).toBe("tool-pre");
    expect(eventKind("PostToolUse")).toBe("tool-post");
    expect(eventKind("UserPromptSubmit")).toBe("prompt");
  });

  it("falls back to 'other' for unknown types", () => {
    expect(eventKind("Something")).toBe("other");
  });
});
