import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Kanban data: every session plus a few derived counts, newest activity first.
export async function GET() {
  const sessions = db
    .prepare(
      `SELECT s.*,
              (SELECT COUNT(*) FROM events e WHERE e.session_id = s.id)      AS event_count,
              (SELECT COUNT(*) FROM tool_calls t WHERE t.session_id = s.id)  AS tool_count
       FROM sessions s
       ORDER BY datetime(s.last_seen) DESC
       LIMIT 200`,
    )
    .all();

  return NextResponse.json({ sessions });
}
