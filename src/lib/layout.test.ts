import { describe, expect, it } from "vitest";
import { HEIGHT_PRESETS, nextPreset, sanitizeIdList, sanitizeSizes, SPAN_PRESETS } from "@/lib/layout";

describe("nextPreset", () => {
  it("advances and wraps around", () => {
    expect(nextPreset(SPAN_PRESETS, "lg:col-span-2")).toBe("lg:col-span-3");
    expect(nextPreset(SPAN_PRESETS, SPAN_PRESETS[SPAN_PRESETS.length - 1])).toBe(SPAN_PRESETS[0]);
  });

  it("falls back to the first entry for an unknown current value", () => {
    expect(nextPreset(HEIGHT_PRESETS, "h-[999px]")).toBe(HEIGHT_PRESETS[0]);
  });
});

describe("sanitizeSizes", () => {
  const valid = ["a", "b"];

  it("keeps only known ids with valid span + height", () => {
    const out = sanitizeSizes(
      {
        a: { span: "lg:col-span-4", height: "h-auto" },
        b: { span: 123, height: "h-auto" }, // bad span
        c: { span: "lg:col-span-2", height: "h-auto" }, // unknown id
      },
      valid,
    );
    expect(out).toEqual({ a: { span: "lg:col-span-4", height: "h-auto" } });
  });

  it("returns an empty map for non-object input", () => {
    expect(sanitizeSizes(null, valid)).toEqual({});
    expect(sanitizeSizes("nope", valid)).toEqual({});
  });
});

describe("sanitizeIdList", () => {
  it("keeps known string ids and dedupes them", () => {
    expect(sanitizeIdList(["a", "b", "a", "x", 5], ["a", "b"])).toEqual(["a", "b"]);
  });

  it("returns an empty array for non-array input", () => {
    expect(sanitizeIdList(null, ["a"])).toEqual([]);
    expect(sanitizeIdList({}, ["a"])).toEqual([]);
  });
});
