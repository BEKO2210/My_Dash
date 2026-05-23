import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { errorSeries, errorStats, recentErrors, topFailingTools } from "@/lib/errors";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Error rate (windowed), per-day series, top failing tools and recent failures.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(Math.max(Math.trunc(Number(url.searchParams.get("limit")) || 50), 1), 500);
  const days = Math.min(Math.max(Math.trunc(Number(url.searchParams.get("days")) || 14), 1), 90);
  const sinceIso = new Date(Date.now() - days * 86_400_000).toISOString().replace("T", " ").slice(0, 19);
  try {
    return NextResponse.json({
      stats: errorStats(db, sinceIso),
      series: errorSeries(db, days),
      topTools: topFailingTools(db, 6, sinceIso),
      recent: recentErrors(db, limit),
    });
  } catch (err) {
    log.error("/api/errors failed", err);
    return NextResponse.json({
      stats: { toolCalls: 0, failures: 0, errorRate: 0 },
      series: [],
      topTools: [],
      recent: [],
    });
  }
}
