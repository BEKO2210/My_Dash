import type { SessionRow, ToolCallRow } from "./types";

// Pure graph-assembly logic for /api/graph, kept free of the DB and Next.js so it
// can be unit-tested in isolation. The route fetches rows and hands them here.

export type NodeType = "session" | "tool" | "file" | "prompt";
// Refines a "file"-type (resource) node so both Claude and humans see what it is.
export type TargetKind = "file" | "command" | "url" | "pattern";

export interface GraphNode {
  id: string;
  label: string;
  type: NodeType;
  val: number;
  // Extra context surfaced when a node is clicked in the 3D graph.
  meta?: {
    sessionId?: string;
    project?: string | null;
    status?: string;
    lastSeen?: string;
    path?: string;
    kind?: TargetKind;
    calls?: number;
    role?: "user" | "agent";
    text?: string;
  };
}

export interface GraphLink {
  source: string;
  target: string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

// One UserPromptSubmit event, as read for a session's prompt nodes.
export interface PromptRow {
  summary: string | null;
  payload_json: string;
  created_at: string;
}

export function clip(s: string, n: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
}

// Executable of a shell command: drop leading VAR=val and take the first program
// of the first sub-command. Grouping by this collapses noisy unique commands
// (e.g. dozens of `grep …`) into one readable "grep" node.
export function programName(cmd: string): string {
  // Scan sub-commands; skip pure `cd`/env prefixes so the *real* program groups
  // (e.g. `cd x && node …` → "node", not "cd").
  const parts = cmd.trim().split(/&&|\|\||[;|]/);
  for (const part of parts) {
    const tokens = part.trim().split(/\s+/).filter(Boolean);
    let i = 0;
    while (i < tokens.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[i])) i++;
    let prog = tokens[i];
    if (!prog || prog === "cd") continue;
    if (prog.includes("/")) prog = prog.split("/").pop() || prog;
    return prog;
  }
  return "cd";
}

// Turn a raw tool target into a compact, unambiguous node: stable key (so equal
// targets share a node across sessions), short label, explicit kind, full value.
export function describeTarget(
  toolName: string | null,
  raw: string,
): { key: string; label: string; kind: TargetKind; full: string } {
  const t = raw.trim();

  if (/^https?:\/\//i.test(t)) {
    try {
      const host = new URL(t).host;
      return { key: `u:${host}`, label: host, kind: "url", full: t };
    } catch {
      /* fall through */
    }
  }

  const looksPath =
    t.startsWith("/") || t.startsWith("./") || t.startsWith("../") || t.startsWith("~") || (!/\s/.test(t) && t.includes("/"));

  if (toolName === "Bash" || (!looksPath && /\s/.test(t))) {
    const prog = programName(t);
    return { key: `cmd:${prog}`, label: prog, kind: "command", full: t };
  }

  if (looksPath) {
    const parts = t.replace(/\/+$/, "").split("/").filter(Boolean);
    return { key: `f:${t}`, label: parts.slice(-2).join("/") || t, kind: "file", full: t };
  }

  const label = t.length > 24 ? t.slice(0, 23) + "…" : t;
  return { key: `q:${t}`, label, kind: "pattern", full: t };
}

// Builds Session -> Tool -> Resource. Resource ids are global so the same file/command/url
// across sessions links them — that's what makes the 3D graph reveal structure.
export function buildGraphData(
  sessions: SessionRow[],
  promptsBySession: Map<string, PromptRow[]>,
  callsBySession: Map<string, ToolCallRow[]>,
): GraphData {
  const nodes = new Map<string, GraphNode>();
  const links: GraphLink[] = [];
  const linkSeen = new Set<string>();

  const addNode = (id: string, label: string, type: NodeType, meta?: GraphNode["meta"]) => {
    const n = nodes.get(id);
    if (n) {
      n.val += 1;
      if (n.meta) n.meta.calls = (n.meta.calls ?? 1) + 1;
    } else {
      nodes.set(id, { id, label, type, val: 1, meta: { ...meta, calls: 1 } });
    }
  };
  const addLink = (source: string, target: string) => {
    const key = `${source}->${target}`;
    if (linkSeen.has(key)) return;
    linkSeen.add(key);
    links.push({ source, target });
  };

  for (const s of sessions) {
    const sid = `s:${s.id}`;
    nodes.set(sid, {
      id: sid,
      label: s.title || s.project_name || s.id.slice(0, 8),
      type: "session",
      val: 3,
      meta: {
        sessionId: s.id,
        project: s.project_name,
        status: s.status,
        lastSeen: s.last_seen,
      },
    });

    // Your prompts: each UserPromptSubmit becomes a prompt node hanging off the session.
    const prompts = promptsBySession.get(s.id) ?? [];
    prompts.forEach((p, i) => {
      let text = "";
      try {
        const pj = JSON.parse(p.payload_json);
        if (typeof pj.prompt === "string") text = pj.prompt;
      } catch {
        /* fall back to summary */
      }
      if (!text && p.summary) text = p.summary.replace(/^Prompt:\s*/, "");
      text = text.trim();
      if (!text) return;
      const pid = `p:${s.id}:${i}`;
      nodes.set(pid, {
        id: pid,
        label: clip(text, 32),
        type: "prompt",
        val: 1.8,
        meta: { role: "user", text: clip(text, 500), lastSeen: p.created_at },
      });
      addLink(sid, pid);
    });

    const calls = callsBySession.get(s.id) ?? [];
    for (const c of calls) {
      const tid = `t:${s.id}:${c.tool_name}`;
      addNode(tid, c.tool_name, "tool");
      addLink(sid, tid);

      if (!c.target) continue;

      // Claude's prompts to sub-agents (Task) become prompt nodes; other targets
      // become file/command/url/pattern resources.
      if (c.tool_name === "Task") {
        const pid = `pa:${s.id}:${c.target}`;
        addNode(pid, clip(c.target, 32), "prompt", { role: "agent", text: clip(c.target, 500) });
        addLink(tid, pid);
      } else {
        const d = describeTarget(c.tool_name, c.target);
        addNode(d.key, d.label, "file", { path: d.full, kind: d.kind });
        addLink(tid, d.key);
      }
    }
  }

  // Drop isolated nodes (e.g. a session with no tools/prompts). A lone, unconnected
  // node only pushes the force layout — and the initial camera — far out.
  const linked = new Set<string>();
  for (const l of links) {
    linked.add(l.source);
    linked.add(l.target);
  }
  const connected = [...nodes.values()].filter((n) => linked.has(n.id));

  return { nodes: connected, links };
}
