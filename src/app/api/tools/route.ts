import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toolFrequency } from "@/lib/tools";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Most-used tools, optionally within the last ?days=N (0/absent = all time).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(Math.max(Math.trunc(Number(url.searchParams.get("limit")) || 12), 1), 50);
  const days = Math.trunc(Number(url.searchParams.get("days")) || 0);
  const sinceIso =
    days > 0 ? new Date(Date.now() - days * 86_400_000).toISOString().replace("T", " ").slice(0, 19) : null;
  try {
    return NextResponse.json({ tools: toolFrequency(db, limit, sinceIso) });
  } catch (err) {
    log.error("/api/tools failed", err);
    return NextResponse.json({ tools: [] });
  }
}
