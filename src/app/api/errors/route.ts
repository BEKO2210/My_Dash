import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { errorStats, recentErrors } from "@/lib/errors";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Error rate + recent failures for the error-rate widget and the errors panel.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(Math.max(Math.trunc(Number(url.searchParams.get("limit")) || 50), 1), 500);
  const since = url.searchParams.get("since"); // optional ISO timestamp
  try {
    return NextResponse.json({ stats: errorStats(db, since), recent: recentErrors(db, limit) });
  } catch (err) {
    log.error("/api/errors failed", err);
    return NextResponse.json({ stats: { toolCalls: 0, failures: 0, errorRate: 0 }, recent: [] });
  }
}
