import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { log } from "@/lib/log";
import type { SessionRow } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A session that hasn't produced an event in this long, yet was never formally ended
// (terminal closed, crash, no SessionEnd hook), is treated as ended so it stops
// piling up forever in the "waiting" column. Override via MC_STALE_MINUTES.
function staleMinutes(): number {
  const m = Number(process.env.MC_STALE_MINUTES);
  return Number.isFinite(m) && m > 0 ? m : 30;
}

type SessionCard = SessionRow & { event_count: number; tool_count: number };

// Kanban data: every session plus a few derived counts, newest activity first.
export async function GET() {
  try {
    const rows = db
      .prepare(
        `SELECT s.*,
                (SELECT COUNT(*) FROM events e WHERE e.session_id = s.id)      AS event_count,
                (SELECT COUNT(*) FROM tool_calls t WHERE t.session_id = s.id)  AS tool_count
         FROM sessions s
         ORDER BY datetime(s.last_seen) DESC
         LIMIT 200`,
      )
      .all() as SessionCard[];

    const cutoffMs = Date.now() - staleMinutes() * 60_000;
    const sessions = rows.map((s) => {
      if (s.status !== "ended") {
        const lastSeenMs = Date.parse(s.last_seen.replace(" ", "T") + "Z");
        if (Number.isFinite(lastSeenMs) && lastSeenMs < cutoffMs) {
          return { ...s, status: "ended" as const, stale: true };
        }
      }
      return s;
    });

    return NextResponse.json({ sessions });
  } catch (err) {
    log.error("/api/sessions failed", err);
    return NextResponse.json({ sessions: [] });
  }
}
