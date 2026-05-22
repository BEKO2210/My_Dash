import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Recent events for the live stream's initial backlog (SSE takes over for new ones).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("session");
  const limit = Math.min(Number(url.searchParams.get("limit")) || 100, 500);

  const events = sessionId
    ? db
        .prepare(
          `SELECT * FROM events WHERE session_id = ? ORDER BY id DESC LIMIT ?`,
        )
        .all(sessionId, limit)
    : db.prepare(`SELECT * FROM events ORDER BY id DESC LIMIT ?`).all(limit);

  return NextResponse.json({ events });
}
