import { describe, expect, it } from "vitest";
import { isExpandable, nodeSummary, valueKind } from "@/lib/json-tree";

describe("valueKind", () => {
  it("classifies JSON values", () => {
    expect(valueKind({})).toBe("object");
    expect(valueKind([])).toBe("array");
    expect(valueKind("x")).toBe("string");
    expect(valueKind(3)).toBe("number");
    expect(valueKind(true)).toBe("boolean");
    expect(valueKind(null)).toBe("null");
    expect(valueKind(undefined)).toBe("null");
  });
});

describe("isExpandable", () => {
  it("is true only for non-empty containers", () => {
    expect(isExpandable({ a: 1 })).toBe(true);
    expect(isExpandable([1])).toBe(true);
    expect(isExpandable({})).toBe(false);
    expect(isExpandable([])).toBe(false);
    expect(isExpandable("x")).toBe(false);
  });
});

describe("nodeSummary", () => {
  it("summarizes containers by size", () => {
    expect(nodeSummary({ a: 1, b: 2 })).toBe("{2}");
    expect(nodeSummary([1, 2, 3])).toBe("[3]");
  });

  it("renders primitives, quoting strings", () => {
    expect(nodeSummary("hi")).toBe('"hi"');
    expect(nodeSummary(42)).toBe("42");
    expect(nodeSummary(false)).toBe("false");
    expect(nodeSummary(null)).toBe("null");
    expect(nodeSummary(undefined)).toBe("undefined");
  });
});
