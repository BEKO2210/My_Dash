import { describe, expect, it } from "vitest";
import { getParam, setParam } from "@/lib/deep-link";

describe("setParam", () => {
  it("adds a param to an empty query", () => {
    expect(setParam("", "q", "hello")).toBe("?q=hello");
  });

  it("updates a param without clobbering others", () => {
    expect(setParam("?range=7d&project=alpha", "q", "ingest")).toBe("?range=7d&project=alpha&q=ingest");
    expect(setParam("?range=7d&q=old", "q", "new")).toBe("?range=7d&q=new");
  });

  it("removes a param when the value is empty, collapsing to '' when none remain", () => {
    expect(setParam("?q=hello", "q", "")).toBe("");
    expect(setParam("?range=7d&q=hello", "q", "")).toBe("?range=7d");
  });

  it("encodes special characters", () => {
    expect(setParam("", "q", "a b")).toBe("?q=a+b");
  });
});

describe("getParam", () => {
  it("reads a present param and returns '' when absent", () => {
    expect(getParam("?q=hello&range=7d", "q")).toBe("hello");
    expect(getParam("?range=7d", "q")).toBe("");
  });
});
