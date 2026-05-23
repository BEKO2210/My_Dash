import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Recent events for the live stream's initial backlog (SSE takes over for new ones).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("session");
  const limit = Math.min(Math.max(Math.trunc(Number(url.searchParams.get("limit")) || 100), 1), 500);

  try {
    const events = sessionId
      ? db
          .prepare(`SELECT * FROM events WHERE session_id = ? ORDER BY id DESC LIMIT ?`)
          .all(sessionId, limit)
      : db.prepare(`SELECT * FROM events ORDER BY id DESC LIMIT ?`).all(limit);

    return NextResponse.json({ events });
  } catch (err) {
    log.error("/api/events failed", err);
    return NextResponse.json({ events: [] });
  }
}
