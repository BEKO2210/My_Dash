import { NextResponse } from "next/server";
import { ingest } from "@/lib/ingest";
import type { HookPayload } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The ONLY write path. Fed exclusively by Claude Code hooks (machine events), never by an LLM.
export async function POST(req: Request) {
  const requiredToken = process.env.MC_HOOK_TOKEN;
  if (requiredToken && req.headers.get("x-hook-token") !== requiredToken) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // Reject oversized payloads early (a hook should never send megabytes).
  const MAX_BODY = 4 * 1024 * 1024;
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY) {
    return NextResponse.json({ ok: false, error: "payload too large" }, { status: 413 });
  }

  const headerEvent = req.headers.get("x-hook-event") ?? "";
  let payload: HookPayload;
  try {
    const text = await req.text();
    if (text.length > MAX_BODY) {
      return NextResponse.json({ ok: false, error: "payload too large" }, { status: 413 });
    }
    payload = text ? (JSON.parse(text) as HookPayload) : {};
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  try {
    const { event } = ingest(headerEvent, payload);
    return NextResponse.json({ ok: true, id: event.id });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "ingest failed" },
      { status: 500 },
    );
  }
}
