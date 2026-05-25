import { NextResponse } from "next/server";
import { eurRate } from "@/lib/ccusage";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Single source of truth for the EUR/USD rate: the SERVER's EUR_PER_USD — the exact
// rate ccusage uses to compute `costEur`. The client reads this (instead of a
// separate build-inlined NEXT_PUBLIC_EUR_PER_USD) so client-converted EUR amounts
// can't diverge from server-computed ones. Read-only; degrades to the default.
export async function GET() {
  try {
    return NextResponse.json({ eurPerUsd: eurRate() });
  } catch (err) {
    log.error("/api/rate failed", err);
    return NextResponse.json({ eurPerUsd: 0.92 });
  }
}
