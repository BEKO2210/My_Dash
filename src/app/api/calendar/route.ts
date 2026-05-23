import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dailyActivity } from "@/lib/calendar";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Per-day activity for the year calendar heatmap (53 weeks ending today).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const days = Math.min(Math.max(Math.trunc(Number(url.searchParams.get("days")) || 371), 7), 731);
  try {
    return NextResponse.json({ days: dailyActivity(db, days) });
  } catch (err) {
    log.error("/api/calendar failed", err);
    return NextResponse.json({ days: [] });
  }
}
