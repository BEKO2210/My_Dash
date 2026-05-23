import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { log } from "@/lib/log";
import { parseLastEventId } from "@/lib/sse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Backlog for the live stream. Default: the most recent events (newest first).
// With ?since=<id>: only events newer than that id (oldest first) — the resume
// path so a reconnecting client can fetch exactly the gap it missed.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("session");
  const since = parseLastEventId(url.searchParams.get("since"));
  const limit = Math.min(Math.max(Math.trunc(Number(url.searchParams.get("limit")) || 100), 1), 500);

  try {
    let events: unknown[];
    if (since != null) {
      events = sessionId
        ? db
            .prepare(`SELECT * FROM events WHERE id > ? AND session_id = ? ORDER BY id ASC LIMIT ?`)
            .all(since, sessionId, limit)
        : db.prepare(`SELECT * FROM events WHERE id > ? ORDER BY id ASC LIMIT ?`).all(since, limit);
    } else {
      events = sessionId
        ? db
            .prepare(`SELECT * FROM events WHERE session_id = ? ORDER BY id DESC LIMIT ?`)
            .all(sessionId, limit)
        : db.prepare(`SELECT * FROM events ORDER BY id DESC LIMIT ?`).all(limit);
    }

    return NextResponse.json({ events });
  } catch (err) {
    log.error("/api/events failed", err);
    return NextResponse.json({ events: [] });
  }
}
