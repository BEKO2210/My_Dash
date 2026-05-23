import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { describeTarget } from "@/lib/graph";
import { buildSankey, type SankeyTriple } from "@/lib/sankey";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// project → tool → resource-kind flow from recent tool calls that touched a resource.
export async function GET() {
  try {
    const rows = db
      .prepare(
        `SELECT COALESCE(NULLIF(s.project_name, ''), '(unknown)') AS project,
                tc.tool_name AS tool, tc.target AS target
         FROM tool_calls tc
         JOIN sessions s ON s.id = tc.session_id
         WHERE tc.target IS NOT NULL
         ORDER BY tc.id DESC
         LIMIT 5000`,
      )
      .all() as { project: string; tool: string; target: string }[];
    const triples: SankeyTriple[] = rows.map((r) => ({
      project: r.project,
      tool: r.tool,
      kind: describeTarget(r.tool, r.target).kind,
    }));
    return NextResponse.json(buildSankey(triples));
  } catch (err) {
    log.error("/api/sankey failed", err);
    return NextResponse.json({ nodes: [], links: [] });
  }
}
