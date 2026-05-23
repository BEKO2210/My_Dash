import { describe, expect, it } from "vitest";
import { estimateCostUsd, priceFor } from "@/lib/pricing";

describe("priceFor", () => {
  it("matches the model family", () => {
    expect(priceFor("claude-opus-4-7").input).toBe(15);
    expect(priceFor("claude-sonnet-4-6").input).toBe(3);
    expect(priceFor("claude-haiku-4-5").input).toBe(0.8);
  });

  it("falls back to Sonnet pricing for null/unknown models", () => {
    expect(priceFor(null)).toEqual(priceFor("claude-sonnet-4-6"));
    expect(priceFor("some-future-model")).toEqual(priceFor("claude-sonnet-4-6"));
  });
});

describe("estimateCostUsd", () => {
  it("prices a million input tokens at the per-MTok rate", () => {
    expect(
      estimateCostUsd({
        inputTokens: 1_000_000,
        outputTokens: 0,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
        model: "claude-opus-4-7",
      }),
    ).toBe(15);
  });

  it("sums all token classes at their respective rates", () => {
    // opus: 500*15 + 120*75 + 100*18.75 + 200*1.5 = 18675 (per MTok) -> /1e6
    expect(
      estimateCostUsd({
        inputTokens: 500,
        outputTokens: 120,
        cacheCreationTokens: 100,
        cacheReadTokens: 200,
        model: "claude-opus-4-7",
      }),
    ).toBeCloseTo(0.018675, 9);
  });

  it("uses the fallback price for an unknown model", () => {
    // sonnet input rate $3/MTok
    expect(
      estimateCostUsd({
        inputTokens: 1_000_000,
        outputTokens: 0,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
        model: null,
      }),
    ).toBe(3);
  });
});
