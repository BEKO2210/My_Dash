import { describe, expect, it } from "vitest";
import { EMPTY_FACETS, facetsActive, sessionMatchesFacets } from "@/lib/facets";

const s = (project_name: string | null, status: string) => ({ project_name, status });

describe("facetsActive", () => {
  it("is false when empty, true when any facet is set", () => {
    expect(facetsActive(EMPTY_FACETS)).toBe(false);
    expect(facetsActive({ project: "a", status: "" })).toBe(true);
    expect(facetsActive({ project: "", status: "active" })).toBe(true);
  });
});

describe("sessionMatchesFacets", () => {
  it("matches everything with empty facets", () => {
    expect(sessionMatchesFacets(s("alpha", "active"), EMPTY_FACETS)).toBe(true);
  });

  it("filters by project", () => {
    expect(sessionMatchesFacets(s("alpha", "active"), { project: "alpha", status: "" })).toBe(true);
    expect(sessionMatchesFacets(s("beta", "active"), { project: "alpha", status: "" })).toBe(false);
  });

  it("filters by status", () => {
    expect(sessionMatchesFacets(s("alpha", "active"), { project: "", status: "active" })).toBe(true);
    expect(sessionMatchesFacets(s("alpha", "ended"), { project: "", status: "active" })).toBe(false);
  });

  it("requires all set facets to match", () => {
    expect(sessionMatchesFacets(s("alpha", "active"), { project: "alpha", status: "active" })).toBe(true);
    expect(sessionMatchesFacets(s("alpha", "ended"), { project: "alpha", status: "active" })).toBe(false);
  });

  it("treats a null project as not matching a project facet", () => {
    expect(sessionMatchesFacets(s(null, "active"), { project: "alpha", status: "" })).toBe(false);
  });
});
