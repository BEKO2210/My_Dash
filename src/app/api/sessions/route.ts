import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { markStaleSessions, sessionCards, staleCutoffMs } from "@/lib/session-list";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Kanban data: every session plus a few derived counts, newest activity first.
export async function GET() {
  try {
    const rows = sessionCards(db, 200);
    const sessions = markStaleSessions(rows, staleCutoffMs());
    return NextResponse.json({ sessions });
  } catch (err) {
    log.error("/api/sessions failed", err);
    return NextResponse.json({ sessions: [] });
  }
}
