import { describe, expect, it } from "vitest";
import { viewState } from "@/components/widget-view";

describe("viewState (shared widget state decision, #31)", () => {
  it("is loading on first load with no data", () => {
    expect(viewState({ data: null, loading: true, error: false })).toBe("loading");
  });

  it("is error when fetch failed and no data to fall back to", () => {
    expect(viewState({ data: null, loading: false, error: true })).toBe("error");
  });

  it("prefers error over loading when both and no data (retry in flight after failure)", () => {
    expect(viewState({ data: null, loading: true, error: true })).toBe("error");
  });

  it("is empty when loaded but data is null and not loading/erroring", () => {
    expect(viewState({ data: null, loading: false, error: false })).toBe("empty");
  });

  it("is empty when data present but isEmpty() is true", () => {
    expect(viewState({ data: { items: [] }, loading: false, error: false }, (d) => d.items.length === 0)).toBe("empty");
  });

  it("is ready when data present and non-empty", () => {
    expect(viewState({ data: { items: [1] }, loading: false, error: false }, (d) => d.items.length === 0)).toBe("ready");
  });

  it("keeps showing ready data during a background poll error (data retained)", () => {
    expect(viewState({ data: { items: [1] }, loading: false, error: true }, (d) => d.items.length === 0)).toBe("ready");
  });

  it("treats missing isEmpty as never-empty when data is present", () => {
    expect(viewState({ data: 0 as unknown, loading: false, error: false })).toBe("ready");
  });
});
