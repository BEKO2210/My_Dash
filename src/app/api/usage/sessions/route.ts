import { NextResponse } from "next/server";
import { getSessionUsage } from "@/lib/ccusage";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Per-session cost/tokens/models from ccusage.
export async function GET() {
  try {
    return NextResponse.json(await getSessionUsage());
  } catch (err) {
    log.error("/api/usage/sessions failed", err);
    return NextResponse.json({ sessions: [], available: false });
  }
}
