import { describe, expect, it } from "vitest";
import { modelShare, OTHER, shortModel } from "@/lib/model-usage";
import type { UsageModel } from "@/lib/ccusage";

function model(name: string, costUsd: number, totalTokens: number): UsageModel {
  return {
    model: name,
    inputTokens: 0,
    outputTokens: 0,
    cacheTokens: 0,
    totalTokens,
    costUsd,
    costEur: 0,
  };
}

describe("shortModel", () => {
  it("strips the claude- prefix", () => {
    expect(shortModel("claude-opus-4-7")).toBe("opus-4-7");
    expect(shortModel("gpt-x")).toBe("gpt-x");
  });
});

describe("modelShare", () => {
  it("computes value/pct per model by mode, sorted, filtering zeros", () => {
    const models = [model("claude-opus-4-7", 8, 100), model("claude-sonnet-4-6", 2, 300), model("z", 0, 0)];
    const { slices, total } = modelShare(models, "cost");
    expect(total).toBe(10);
    expect(slices.map((s) => s.name)).toEqual(["opus-4-7", "sonnet-4-6"]); // sorted by cost, zero filtered
    expect(slices[0].pct).toBeCloseTo(0.8, 5);
  });

  it("ranks by tokens in tokens mode", () => {
    const models = [model("claude-opus-4-7", 8, 100), model("claude-sonnet-4-6", 2, 300)];
    expect(modelShare(models, "tokens").slices[0].name).toBe("sonnet-4-6");
  });

  it("groups beyond the max into Other", () => {
    const models = Array.from({ length: 8 }, (_, i) => model(`m${i}`, 8 - i, 0));
    const { slices } = modelShare(models, "cost", 6);
    expect(slices).toHaveLength(6);
    const other = slices[slices.length - 1];
    expect(other.full).toBe(OTHER);
    expect(other.value).toBe(3 + 2 + 1); // m5+m6+m7 costs
  });

  it("returns no slices for empty input", () => {
    expect(modelShare([], "cost")).toEqual({ slices: [], total: 0 });
  });
});
