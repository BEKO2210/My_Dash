import { describe, expect, it } from "vitest";
import { sanitizeGraph } from "./sanitize";

const n = (id: string) => ({ id });

describe("sanitizeGraph (tool-graph dangling-link guard)", () => {
  it("drops a link whose target node is missing", () => {
    const out = sanitizeGraph({ nodes: [n("a"), n("b")], links: [{ source: "a", target: "ghost" }] });
    expect(out.links).toEqual([]);
    expect(out.nodes).toHaveLength(2);
  });

  it("drops a link whose source node is missing", () => {
    const out = sanitizeGraph({ nodes: [n("a")], links: [{ source: "ghost", target: "a" }] });
    expect(out.links).toEqual([]);
  });

  it("keeps links whose endpoints both exist", () => {
    const links = [{ source: "a", target: "b" }];
    const out = sanitizeGraph({ nodes: [n("a"), n("b")], links });
    expect(out.links).toEqual(links);
  });

  it("resolves object-form endpoints (post-layout) by id", () => {
    const out = sanitizeGraph({
      nodes: [n("a"), n("b")],
      links: [{ source: { id: "a" }, target: { id: "b" } }],
    });
    expect(out.links).toHaveLength(1);
  });

  it("dedupes duplicate node ids and id-less nodes", () => {
    const out = sanitizeGraph({
      nodes: [n("a"), n("a"), { id: undefined as unknown as string }],
      links: [],
    });
    expect(out.nodes).toHaveLength(1);
  });

  it("returns the SAME reference when nothing needs removing (stable identity)", () => {
    const data = { nodes: [n("a"), n("b")], links: [{ source: "a", target: "b" }] };
    expect(sanitizeGraph(data)).toBe(data);
  });

  it("returns a NEW object when something was dropped", () => {
    const data = { nodes: [n("a")], links: [{ source: "a", target: "x" }] };
    expect(sanitizeGraph(data)).not.toBe(data);
  });
});
