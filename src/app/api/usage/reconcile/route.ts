import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUsage } from "@/lib/ccusage";
import { reconcileSessions } from "@/lib/reconcile";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Per-session cost reconciled against ccusage (preferred when available), with the
// transcript estimate and the discrepancy alongside.
export async function GET() {
  try {
    const sessions = db
      .prepare(`SELECT id, cost_usd FROM sessions ORDER BY datetime(last_seen) DESC LIMIT 500`)
      .all() as { id: string; cost_usd: number }[];
    const usage = await getSessionUsage();
    return NextResponse.json({
      sessions: reconcileSessions(sessions, usage.sessions),
      ccusageAvailable: usage.available,
    });
  } catch (err) {
    log.error("/api/usage/reconcile failed", err);
    return NextResponse.json({ sessions: [], ccusageAvailable: false });
  }
}
