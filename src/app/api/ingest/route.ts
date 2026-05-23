import { NextResponse } from "next/server";
import { ingest } from "@/lib/ingest";
import { parseHookPayload } from "@/lib/hook-schema";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The ONLY write path. Fed exclusively by Claude Code hooks (machine events), never by an LLM.
//
// Security model: the server binds to 127.0.0.1, so this endpoint is only reachable
// from the local machine. It takes no cookies/ambient credentials, so classic CSRF
// (a browser auto-attaching a session) doesn't apply — the only caller is the hook
// forwarder. Set MC_HOOK_TOKEN to additionally require a shared secret (X-Hook-Token)
// and reject any other local process from posting events.
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
  let raw: unknown;
  try {
    const text = await req.text();
    if (text.length > MAX_BODY) {
      return NextResponse.json({ ok: false, error: "payload too large" }, { status: 413 });
    }
    raw = text ? JSON.parse(text) : {};
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  // Tolerant schema check: unknown fields pass, but a wrong-typed known field is
  // a malformed request (real hooks never send those).
  const parsed = parseHookPayload(raw);
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  }
  const payload = parsed.payload;

  // Real Claude Code hooks always carry a session_id. Anything without one
  // (health checks, stray/empty POSTs) is ignored so it never creates a junk
  // "unknown" session card.
  if (typeof payload.session_id !== "string" || payload.session_id.trim() === "") {
    return NextResponse.json({ ok: true, skipped: "no session_id" });
  }

  try {
    const { event } = ingest(headerEvent, payload);
    return NextResponse.json({ ok: true, id: event.id });
  } catch (err) {
    log.error("/api/ingest failed", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "ingest failed" },
      { status: 500 },
    );
  }
}
