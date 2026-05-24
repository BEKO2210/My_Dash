import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getConfig, setConfig } from "@/lib/config";
import { invalidateQuietCache } from "@/lib/quiet";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Quiet-hours schedule. Suppresses non-critical alert channels during the window.
export async function GET() {
  try {
    return NextResponse.json({
      enabled: getConfig(db, "quiet.enabled") === "1",
      start: getConfig(db, "quiet.start") ?? "22:00",
      end: getConfig(db, "quiet.end") ?? "07:00",
    });
  } catch (err) {
    log.error("/api/alerts/quiet GET failed", err);
    return NextResponse.json({ enabled: false, start: "22:00", end: "07:00" });
  }
}

const HHMM = z.string().regex(/^\d{1,2}:\d{2}$/);
const Body = z.object({
  enabled: z.boolean().optional(),
  start: HHMM.optional(),
  end: HHMM.optional(),
});

export async function POST(req: Request) {
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });
    if (parsed.data.enabled !== undefined) setConfig(db, "quiet.enabled", parsed.data.enabled ? "1" : "0");
    if (parsed.data.start !== undefined) setConfig(db, "quiet.start", parsed.data.start);
    if (parsed.data.end !== undefined) setConfig(db, "quiet.end", parsed.data.end);
    invalidateQuietCache();
    return NextResponse.json({ ok: true });
  } catch (err) {
    log.error("/api/alerts/quiet POST failed", err);
    return NextResponse.json({ error: "write failed" }, { status: 500 });
  }
}
