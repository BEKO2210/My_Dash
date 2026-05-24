import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { searchFts } from "@/lib/search-index";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Full-text search (FTS5) across event summaries and prompts.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const limit = Math.min(Math.max(Math.trunc(Number(url.searchParams.get("limit")) || 20), 1), 100);
  try {
    return NextResponse.json({ hits: searchFts(db, q, limit) });
  } catch (err) {
    log.error("/api/search failed", err);
    return NextResponse.json({ hits: [] });
  }
}
