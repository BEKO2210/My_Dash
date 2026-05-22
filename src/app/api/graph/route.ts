import { NextResponse } from "next/server";
import path from "node:path";
import { db } from "@/lib/db";
import type { SessionRow, ToolCallRow } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type NodeType = "session" | "tool" | "file";
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
    calls?: number;
  };
}
interface GraphLink {
  source: string;
  target: string;
}

// Builds Session -> Tool -> File. Files are global ids so the same file across sessions
// links them — that's what makes the 3D graph reveal structure.
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

  const callsForSession = db.prepare(
    `SELECT * FROM tool_calls WHERE session_id = ? LIMIT 300`,
  );

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
        const fid = `f:${c.target}`;
        const label = c.target.includes("/") ? path.basename(c.target) : c.target.slice(0, 24);
        addNode(fid, label, "file", { path: c.target });
        addLink(tid, fid);
      }
    }
  }

  return NextResponse.json({ nodes: [...nodes.values()], links });
}
