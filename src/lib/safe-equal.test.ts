import { describe, expect, it } from "vitest";
import { timingSafeStrEqual } from "@/lib/safe-equal";

describe("timingSafeStrEqual", () => {
  it("is true for identical strings", () => {
    expect(timingSafeStrEqual("s3cr3t-token", "s3cr3t-token")).toBe(true);
    expect(timingSafeStrEqual("", "")).toBe(true);
  });

  it("is false for different strings of equal length", () => {
    expect(timingSafeStrEqual("abcdef", "abcdeg")).toBe(false);
  });

  it("is false for different lengths (no throw)", () => {
    expect(timingSafeStrEqual("abc", "abcd")).toBe(false);
    expect(timingSafeStrEqual("abcd", "abc")).toBe(false);
  });
});
