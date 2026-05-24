import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { anomalyReport } from "@/lib/anomaly";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Latency p95 + error rate, recent (24h) vs baseline (prior 7d).
export async function GET() {
  try {
    return NextResponse.json(anomalyReport(db));
  } catch (err) {
    log.error("/api/anomaly failed", err);
    return NextResponse.json({
      latencyMs: { recent: 0, baseline: 0, deltaPct: 0, anomalous: false },
      errorRate: { recent: 0, baseline: 0, deltaPct: 0, anomalous: false },
      recentSamples: 0,
      baselineSamples: 0,
    });
  }
}
