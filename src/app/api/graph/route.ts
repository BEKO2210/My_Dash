import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildGraphData, type PromptRow } from "@/lib/graph";
import { log } from "@/lib/log";
import type { SessionRow, ToolCallRow } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Reads the rows for the most recent sessions and hands them to the pure
// graph-assembler (src/lib/graph.ts) to build Session -> Tool -> Resource.
export async function GET(req: Request) {
  try {
    return buildGraph(req);
  } catch (err) {
    log.error("/api/graph failed", err);
    return NextResponse.json({ nodes: [], links: [] });
  }
}

function buildGraph(req: Request) {
  const url = new URL(req.url);
  // Default: every session is included so the graph reflects the full history.
  // An explicit ?sessions=N caps it (min 1) for callers that want a lighter graph;
  // SQLite treats LIMIT -1 as "no limit", which is the unbounded default here.
  const raw = url.searchParams.get("sessions");
  const n = Math.trunc(Number(raw));
  const sessionLimit = raw !== null && Number.isFinite(n) && n > 0 ? n : -1;

  const sessions = db
    .prepare(`SELECT * FROM sessions ORDER BY datetime(last_seen) DESC LIMIT ?`)
    .all(sessionLimit) as SessionRow[];

  const callsForSession = db.prepare(`SELECT * FROM tool_calls WHERE session_id = ? LIMIT 300`);
  const promptsForSession = db.prepare(
    `SELECT summary, payload_json, created_at FROM events
     WHERE session_id = ? AND event_type = 'UserPromptSubmit' ORDER BY id ASC LIMIT 60`,
  );

  const promptsBySession = new Map<string, PromptRow[]>();
  const callsBySession = new Map<string, ToolCallRow[]>();
  for (const s of sessions) {
    promptsBySession.set(s.id, promptsForSession.all(s.id) as PromptRow[]);
    callsBySession.set(s.id, callsForSession.all(s.id) as ToolCallRow[]);
  }

  return NextResponse.json(buildGraphData(sessions, promptsBySession, callsBySession));
}
