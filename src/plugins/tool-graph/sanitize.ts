// Pure graph sanitizer for the 3D tool-graph.
//
// react-force-graph resolves each link's `source`/`target` id to the matching
// node object and then reads `.x`/`.y`/`.z`. If a link references an id that is
// not in the node set (a "dangling" link), the endpoint resolves to `undefined`
// and the renderer crashes with "Cannot read properties of undefined (reading
// 'x')". Duplicate or id-less nodes can corrupt the same lookup. This drops both
// before the data reaches the renderer (defense-in-depth alongside the data layer).
//
// Returns the SAME object reference when nothing needed removing, so the widget's
// identity-based memoization doesn't rebuild meshes unnecessarily.

export interface SanitizableNode {
  id: string;
}
export interface SanitizableLink {
  source: string | { id: string };
  target: string | { id: string };
}
export interface SanitizableGraph<N extends SanitizableNode, L extends SanitizableLink> {
  nodes: N[];
  links: L[];
}

const endId = (e: string | { id: string }): string =>
  typeof e === "object" && e !== null ? e.id : e;

export function sanitizeGraph<N extends SanitizableNode, L extends SanitizableLink>(
  data: SanitizableGraph<N, L>,
): SanitizableGraph<N, L> {
  const seen = new Set<string>();
  const nodes: N[] = [];
  for (const n of data.nodes) {
    if (n && typeof n.id === "string" && !seen.has(n.id)) {
      seen.add(n.id);
      nodes.push(n);
    }
  }
  const links = data.links.filter(
    (l) => l != null && seen.has(endId(l.source)) && seen.has(endId(l.target)),
  );
  if (nodes.length === data.nodes.length && links.length === data.links.length) return data;
  return { nodes, links };
}
