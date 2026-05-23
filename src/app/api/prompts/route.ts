import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { promptHistory } from "@/lib/prompts";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Chronological prompt history (redacted at ingest), newest first.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(Math.max(Math.trunc(Number(url.searchParams.get("limit")) || 100), 1), 500);
  try {
    return NextResponse.json({ prompts: promptHistory(db, limit) });
  } catch (err) {
    log.error("/api/prompts failed", err);
    return NextResponse.json({ prompts: [] });
  }
}
