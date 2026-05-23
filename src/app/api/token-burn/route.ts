import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toolTokenBurn } from "@/lib/token-burn";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Estimated token burn per tool (from tool I/O size), biggest first.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(Math.max(Math.trunc(Number(url.searchParams.get("limit")) || 8), 1), 50);
  try {
    return NextResponse.json({ tools: toolTokenBurn(db, limit) });
  } catch (err) {
    log.error("/api/token-burn failed", err);
    return NextResponse.json({ tools: [] });
  }
}
