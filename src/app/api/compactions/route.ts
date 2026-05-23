import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { recentCompactions } from "@/lib/compaction";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Recent context-compaction events (newest first) for the compaction timeline.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(Math.max(Math.trunc(Number(url.searchParams.get("limit")) || 100), 1), 500);
  try {
    return NextResponse.json({ compactions: recentCompactions(db, limit) });
  } catch (err) {
    log.error("/api/compactions failed", err);
    return NextResponse.json({ compactions: [] });
  }
}
