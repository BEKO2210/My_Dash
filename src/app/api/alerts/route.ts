import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { recentAlerts, unreadAlertCount } from "@/lib/alerts";
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
