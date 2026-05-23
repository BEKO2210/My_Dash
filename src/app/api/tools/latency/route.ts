import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { latencyStats } from "@/lib/latency";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Tool-latency distribution + percentiles, optionally for one ?tool=. Also returns
// the list of tools that have duration data, for the widget's filter.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const tool = url.searchParams.get("tool");
  try {
    const durations = (
      db
        .prepare(
          `SELECT duration_ms FROM tool_calls
           WHERE duration_ms IS NOT NULL ${tool ? "AND tool_name = ?" : ""}
           LIMIT 100000`,
        )
        .all(...(tool ? [tool] : [])) as { duration_ms: number }[]
    ).map((r) => r.duration_ms);
    const tools = (
      db
        .prepare(
          `SELECT DISTINCT tool_name FROM tool_calls WHERE duration_ms IS NOT NULL ORDER BY tool_name`,
        )
        .all() as { tool_name: string }[]
    ).map((r) => r.tool_name);
    return NextResponse.json({ stats: latencyStats(durations), tools });
  } catch (err) {
    log.error("/api/tools/latency failed", err);
    return NextResponse.json({
      stats: { count: 0, p50: 0, p95: 0, p99: 0, max: 0, buckets: [] },
      tools: [],
    });
  }
}
