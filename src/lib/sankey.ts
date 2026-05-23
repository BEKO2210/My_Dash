// Build a 3-tier Sankey (project → tool → resource-kind) from classified tool
// calls. Keeps the top projects/tools and merges the rest into "Other" so the
// flow shows dominant paths rather than every sliver. Output is recharts-shaped:
// links reference node indices.
export const OTHER = "Other";

export interface SankeyTriple {
  project: string;
  tool: string;
  kind: string; // file | command | url | pattern
}

export interface SankeyData {
  nodes: { name: string }[];
  links: { source: number; target: number; value: number }[];
}

function topKeys(counts: Map<string, number>, max: number): Set<string> {
  return new Set(
    [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, max)
      .map((e) => e[0]),
  );
}

export function buildSankey(rows: SankeyTriple[], maxProjects = 5, maxTools = 8): SankeyData {
  const projCount = new Map<string, number>();
  const toolCount = new Map<string, number>();
  for (const r of rows) {
    projCount.set(r.project, (projCount.get(r.project) ?? 0) + 1);
    toolCount.set(r.tool, (toolCount.get(r.tool) ?? 0) + 1);
  }
  const keepProj = topKeys(projCount, maxProjects);
  const keepTool = topKeys(toolCount, maxTools);

  const nodes: { name: string }[] = [];
  const ids = new Map<string, number>(); // "tier:name" -> index (tier keeps same names distinct)
  const nodeId = (tier: string, name: string): number => {
    const key = `${tier}:${name}`;
    let i = ids.get(key);
    if (i === undefined) {
      i = nodes.length;
      nodes.push({ name });
      ids.set(key, i);
    }
    return i;
  };

  const linkValue = new Map<string, number>();
  const addLink = (s: number, t: number) => linkValue.set(`${s}>${t}`, (linkValue.get(`${s}>${t}`) ?? 0) + 1);

  for (const r of rows) {
    const p = nodeId("p", keepProj.has(r.project) ? r.project : OTHER);
    const t = nodeId("t", keepTool.has(r.tool) ? r.tool : OTHER);
    const k = nodeId("k", r.kind);
    addLink(p, t);
    addLink(t, k);
  }

  const links = [...linkValue.entries()].map(([key, value]) => {
    const [source, target] = key.split(">").map(Number);
    return { source, target, value };
  });
  return { nodes, links };
}
