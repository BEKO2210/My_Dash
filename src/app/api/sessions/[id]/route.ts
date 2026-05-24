import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessionDetail } from "@/lib/session-detail";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Full detail for one session — the read path behind the /session/[id] page.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "invalid id" }, { status: 400 });
  try {
    const detail = sessionDetail(db, id);
    if (!detail) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json(detail);
  } catch (err) {
    log.error("/api/sessions/[id] failed", err);
    return NextResponse.json({ error: "lookup failed" }, { status: 500 });
  }
}
