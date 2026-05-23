import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { subagentTree } from "@/lib/subagents";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Session → subagent tree, grouped from the Task links captured at ingest.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(Math.max(Math.trunc(Number(url.searchParams.get("limit")) || 200), 1), 1000);
  try {
    return NextResponse.json({ groups: subagentTree(db, limit) });
  } catch (err) {
    log.error("/api/subagents failed", err);
    return NextResponse.json({ groups: [] });
  }
}
