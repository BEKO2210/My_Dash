import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { markStaleSessions, sessionCards } from "@/lib/session-list";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A session that hasn't produced an event in this long, yet was never formally ended
// (terminal closed, crash, no SessionEnd hook), is treated as ended so it stops
// piling up forever in the "waiting" column. Override via MC_STALE_MINUTES.
function staleMinutes(): number {
  const m = Number(process.env.MC_STALE_MINUTES);
  return Number.isFinite(m) && m > 0 ? m : 30;
}

// Kanban data: every session plus a few derived counts, newest activity first.
export async function GET() {
  try {
    const rows = sessionCards(db, 200);
    const sessions = markStaleSessions(rows, Date.now() - staleMinutes() * 60_000);
    return NextResponse.json({ sessions });
  } catch (err) {
    log.error("/api/sessions failed", err);
    return NextResponse.json({ sessions: [] });
  }
}
