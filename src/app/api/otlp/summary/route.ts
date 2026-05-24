import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { otlpAvailable, otlpSessionSummaries } from "@/lib/otlp-map";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Read path for the OTLP-derived per-session mapping (cost, tokens, latency).
// Returns an empty, available:false payload when the optional receiver was never fed.
export async function GET() {
  try {
    const sessions = otlpSessionSummaries(db);
    const totals = sessions.reduce(
      (acc, s) => {
        acc.costUsd += s.costUsd;
        acc.tokens += s.tokens.total;
        acc.requests += s.latency.count;
        return acc;
      },
      { costUsd: 0, tokens: 0, requests: 0 },
    );
    return NextResponse.json({ available: otlpAvailable(db), sessions, totals });
  } catch (err) {
    log.error("/api/otlp/summary failed", err);
    return NextResponse.json({ available: false, sessions: [], totals: { costUsd: 0, tokens: 0, requests: 0 } });
  }
}
