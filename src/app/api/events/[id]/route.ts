import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { eventById, withParsedPayload } from "@/lib/events";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A single event with its payload parsed — the read path behind the drill-down
// detail views.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const eventId = Number(id);
  if (!Number.isInteger(eventId) || eventId <= 0) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  try {
    const row = eventById(db, eventId);
    if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ event: withParsedPayload(row) });
  } catch (err) {
    log.error("/api/events/[id] failed", err);
    return NextResponse.json({ error: "lookup failed" }, { status: 500 });
  }
}
