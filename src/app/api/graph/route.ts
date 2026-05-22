import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { SessionRow, ToolCallRow } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type NodeType = "session" | "tool" | "file";
// Refines a "file"-type (resource) node so both Claude and humans see what it is.
type TargetKind = "file" | "command" | "url" | "pattern";

interface GraphNode {
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
  };
}
interface GraphLink {
  source: string;
  target: string;
}

// Executable of a shell command: drop leading VAR=val and take the first program
// of the first sub-command. Grouping by this collapses noisy unique commands
// (e.g. dozens of `grep …`) into one readable "grep" node.
function programName(cmd: string): string {
  const head = cmd.trim().split(/&&|\|\||[;|]/)[0].trim();
  const tokens = head.split(/\s+/).filter(Boolean);
  let i = 0;
  while (i < tokens.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[i])) i++;
  let prog = tokens[i] ?? head;
  if (prog.includes("/")) prog = prog.split("/").pop() || prog;
  return prog || "cmd";
}

// Turn a raw tool target into a compact, unambiguous node: stable key (so equal
// targets share a node across sessions), short label, explicit kind, full value.
function describeTarget(
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
export async function GET(req: Request) {
  const url = new URL(req.url);
  const sessionLimit = Math.min(Math.max(Math.trunc(Number(url.searchParams.get("sessions")) || 25), 1), 100);

  const sessions = db
    .prepare(`SELECT * FROM sessions ORDER BY datetime(last_seen) DESC LIMIT ?`)
    .all(sessionLimit) as SessionRow[];

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

  const callsForSession = db.prepare(`SELECT * FROM tool_calls WHERE session_id = ? LIMIT 300`);

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

    const calls = callsForSession.all(s.id) as ToolCallRow[];
    for (const c of calls) {
      const tid = `t:${s.id}:${c.tool_name}`;
      addNode(tid, c.tool_name, "tool");
      addLink(sid, tid);

      if (c.target) {
        const d = describeTarget(c.tool_name, c.target);
        addNode(d.key, d.label, "file", { path: d.full, kind: d.kind });
        addLink(tid, d.key);
      }
    }
  }

  return NextResponse.json({ nodes: [...nodes.values()], links });
}
