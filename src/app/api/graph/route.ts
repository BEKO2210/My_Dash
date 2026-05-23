import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildGraphData, type PromptRow } from "@/lib/graph";
import type { SessionRow, ToolCallRow } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Reads the rows for the most recent sessions and hands them to the pure
// graph-assembler (src/lib/graph.ts) to build Session -> Tool -> Resource.
export async function GET(req: Request) {
  try {
    return buildGraph(req);
  } catch (err) {
    console.error("/api/graph failed:", err);
    return NextResponse.json({ nodes: [], links: [] });
  }
}

function buildGraph(req: Request) {
  const url = new URL(req.url);
  const sessionLimit = Math.min(Math.max(Math.trunc(Number(url.searchParams.get("sessions")) || 25), 1), 100);

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
