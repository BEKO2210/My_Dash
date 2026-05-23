import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projectReliability } from "@/lib/reliability";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Tool-call success rate per project (most active first).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(Math.max(Math.trunc(Number(url.searchParams.get("limit")) || 100), 1), 500);
  try {
    return NextResponse.json({ projects: projectReliability(db, limit) });
  } catch (err) {
    log.error("/api/reliability failed", err);
    return NextResponse.json({ projects: [] });
  }
}
