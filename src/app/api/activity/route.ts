import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { recentActivity } from "@/lib/activity";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Hour-bucketed activity counts (UTC) for the heatmap / time-series widgets. The
// client folds UTC buckets into local weekday/hour.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(Math.max(Math.trunc(Number(url.searchParams.get("limit")) || 2000), 1), 10000);
  try {
    return NextResponse.json({ buckets: recentActivity(db, limit) });
  } catch (err) {
    log.error("/api/activity failed", err);
    return NextResponse.json({ buckets: [] });
  }
}
