import { describe, expect, it } from "vitest";
import { DEFAULT_THEME, isHexColor, sanitizeTheme } from "@/lib/theme";

describe("isHexColor", () => {
  it("accepts 6-digit hex and rejects others", () => {
    expect(isHexColor("#4f8cff")).toBe(true);
    expect(isHexColor("#FFF")).toBe(false);
    expect(isHexColor("blue")).toBe(false);
    expect(isHexColor(123)).toBe(false);
  });
});

describe("sanitizeTheme", () => {
  it("keeps a valid theme", () => {
    expect(sanitizeTheme({ mode: "light", accent: "#22d3ee" })).toEqual({ mode: "light", accent: "#22d3ee" });
  });

  it("falls back to defaults for bad fields", () => {
    expect(sanitizeTheme({ mode: "weird", accent: "nope" })).toEqual(DEFAULT_THEME);
    expect(sanitizeTheme(null)).toEqual(DEFAULT_THEME);
    expect(sanitizeTheme("x")).toEqual(DEFAULT_THEME);
  });

  it("defaults mode to dark and accent to the default", () => {
    expect(sanitizeTheme({})).toEqual(DEFAULT_THEME);
  });
});
