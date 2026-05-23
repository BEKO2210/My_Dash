import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { velocitySeries } from "@/lib/velocity";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Per-day velocity aggregates (tool calls, events, sessions, active minutes).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const days = Math.min(Math.max(Math.trunc(Number(url.searchParams.get("days")) || 30), 7), 180);
  try {
    return NextResponse.json({ days: velocitySeries(db, days) });
  } catch (err) {
    log.error("/api/velocity failed", err);
    return NextResponse.json({ days: [] });
  }
}
