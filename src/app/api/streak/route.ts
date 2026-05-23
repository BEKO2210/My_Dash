import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { recentActivity } from "@/lib/activity";
import { dailySessions, hourHistogram, peakHour, streakStats } from "@/lib/streak";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Productivity rollup: day-streak, sessions-per-day trend and peak-hours histogram.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const days = Math.min(Math.max(Math.trunc(Number(url.searchParams.get("days")) || 30), 7), 365);
  try {
    const series = dailySessions(db, days);
    const hours = hourHistogram(recentActivity(db, 10000));
    return NextResponse.json({
      streak: streakStats(series),
      days: series,
      hours,
      peakHour: peakHour(hours),
    });
  } catch (err) {
    log.error("/api/streak failed", err);
    return NextResponse.json({
      streak: { current: 0, longest: 0, activeDays: 0, totalSessions: 0 },
      days: [],
      hours: new Array(24).fill(0),
      peakHour: -1,
    });
  }
}
