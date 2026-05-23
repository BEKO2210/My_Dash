import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { collectStats } from "@/lib/stats";
import { getUsage } from "@/lib/ccusage";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Headline KPIs for the status strip (DB aggregates + today's cost from ccusage).
export async function GET() {
  try {
    const stats = collectStats(db);
    const usage = await getUsage();
    const today = new Date().toISOString().slice(0, 10);
    const costTodayUsd = usage.days.find((d) => d.date === today)?.costUsd ?? 0;
    return NextResponse.json({ ...stats, costTodayUsd, costAvailable: usage.available });
  } catch (err) {
    log.error("/api/stats failed", err);
    return NextResponse.json({
      activeSessions: 0,
      eventsToday: 0,
      toolCallsToday: 0,
      errorRate: 0,
      sparkline: [],
      costTodayUsd: 0,
      costAvailable: false,
    });
  }
}
