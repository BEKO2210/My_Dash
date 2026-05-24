import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toolCallDetail } from "@/lib/errors";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A single tool call with its parsed I/O — the read path behind the error drill-down.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const callId = Number(id);
  if (!Number.isInteger(callId) || callId <= 0) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  try {
    const detail = toolCallDetail(db, callId);
    if (!detail) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ detail });
  } catch (err) {
    log.error("/api/tool-calls/[id] failed", err);
    return NextResponse.json({ error: "lookup failed" }, { status: 500 });
  }
}
