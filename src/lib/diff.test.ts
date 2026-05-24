import { describe, expect, it } from "vitest";
import { diffLines, diffStat } from "@/lib/diff";

describe("diffLines", () => {
  it("marks unchanged, added and removed lines", () => {
    const lines = diffLines("a\nb\nc", "a\nB\nc\nd");
    expect(lines).toEqual([
      { type: "same", text: "a" },
      { type: "del", text: "b" },
      { type: "add", text: "B" },
      { type: "same", text: "c" },
      { type: "add", text: "d" },
    ]);
  });

  it("treats an empty original as all-added", () => {
    expect(diffLines("", "x\ny")).toEqual([
      { type: "add", text: "x" },
      { type: "add", text: "y" },
    ]);
  });

  it("treats an empty target as all-removed", () => {
    expect(diffLines("x\ny", "")).toEqual([
      { type: "del", text: "x" },
      { type: "del", text: "y" },
    ]);
  });

  it("returns all-same for identical input", () => {
    expect(diffLines("a\nb", "a\nb").every((l) => l.type === "same")).toBe(true);
  });
});

describe("diffStat", () => {
  it("counts additions and removals", () => {
    expect(diffStat(diffLines("a\nb\nc", "a\nB\nc\nd"))).toEqual({ added: 2, removed: 1 });
  });
});
