import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { markAlertsRead, markAllAlertsRead, recentAlerts, unreadAlertCount } from "@/lib/alerts";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Recent alerts raised by the rule engine (newest first) + unread count.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(Math.max(Math.trunc(Number(url.searchParams.get("limit")) || 50), 1), 200);
  try {
    return NextResponse.json({ alerts: recentAlerts(db, limit), unread: unreadAlertCount(db) });
  } catch (err) {
    log.error("/api/alerts failed", err);
    return NextResponse.json({ alerts: [], unread: 0 });
  }
}

const Body = z.object({
  all: z.boolean().optional(),
  ids: z.array(z.number().int().positive()).max(500).optional(),
});

// Mark alerts read (the only mutation — local UI read-state, not Claude data).
export async function POST(req: Request) {
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });
    const updated = parsed.data.all ? markAllAlertsRead(db) : markAlertsRead(db, parsed.data.ids ?? []);
    return NextResponse.json({ ok: true, updated });
  } catch (err) {
    log.error("/api/alerts POST failed", err);
    return NextResponse.json({ error: "write failed" }, { status: 500 });
  }
}
