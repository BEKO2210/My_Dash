import { describe, expect, it } from "vitest";
import { buildSankey, OTHER, type SankeyTriple } from "@/lib/sankey";

const t = (project: string, tool: string, kind: string): SankeyTriple => ({ project, tool, kind });

describe("buildSankey", () => {
  it("builds project→tool→kind nodes and aggregates link values", () => {
    const { nodes, links } = buildSankey([
      t("A", "Read", "file"),
      t("A", "Read", "file"),
      t("A", "Bash", "command"),
    ]);
    const name = (i: number) => nodes[i].name;
    // A→Read should have value 2, Read→file value 2.
    const aRead = links.find((l) => name(l.source) === "A" && name(l.target) === "Read");
    expect(aRead?.value).toBe(2);
    const readFile = links.find((l) => name(l.source) === "Read" && name(l.target) === "file");
    expect(readFile?.value).toBe(2);
  });

  it("keeps a project and a tool with the same name as distinct nodes", () => {
    // tool index must differ from project index even with identical names.
    const { nodes } = buildSankey([t("X", "X", "file")]);
    expect(nodes.filter((n) => n.name === "X")).toHaveLength(2);
  });

  it("merges projects/tools beyond the max into Other", () => {
    const rows: SankeyTriple[] = [];
    for (let i = 0; i < 10; i++) rows.push(t(`p${i}`, `tool${i}`, "file"));
    const { nodes } = buildSankey(rows, 3, 4);
    expect(nodes.some((n) => n.name === OTHER)).toBe(true);
  });

  it("returns empty data for no rows", () => {
    expect(buildSankey([])).toEqual({ nodes: [], links: [] });
  });
});
