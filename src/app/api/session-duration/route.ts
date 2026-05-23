import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { durationStats, sessionDurationsMs } from "@/lib/session-duration";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Distribution of session lengths (histogram + median/p95).
export async function GET() {
  try {
    return NextResponse.json(durationStats(sessionDurationsMs(db)));
  } catch (err) {
    log.error("/api/session-duration failed", err);
    return NextResponse.json({ count: 0, median: 0, p95: 0, max: 0, buckets: [] });
  }
}
