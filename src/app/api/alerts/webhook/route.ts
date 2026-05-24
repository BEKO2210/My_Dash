import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getConfig, setConfig } from "@/lib/config";
import { invalidateWebhookCache } from "@/lib/webhook";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Optional outbound webhook config (Slack/Discord). Off by default; the URL is
// only ever sent to when enabled. Local settings, not Claude data.
export async function GET() {
  try {
    return NextResponse.json({
      url: getConfig(db, "webhook.url") ?? "",
      enabled: getConfig(db, "webhook.enabled") === "1",
    });
  } catch (err) {
    log.error("/api/alerts/webhook GET failed", err);
    return NextResponse.json({ url: "", enabled: false });
  }
}

const Body = z.object({
  url: z.string().max(500).optional(),
  enabled: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });
    const url = (parsed.data.url ?? "").trim();
    // Only http(s) URLs may be stored, so an enabled webhook can't target odd schemes.
    if (url && !/^https?:\/\//i.test(url)) {
      return NextResponse.json({ error: "url must be http(s)" }, { status: 400 });
    }
    if (parsed.data.url !== undefined) setConfig(db, "webhook.url", url);
    if (parsed.data.enabled !== undefined) setConfig(db, "webhook.enabled", parsed.data.enabled ? "1" : "0");
    invalidateWebhookCache();
    return NextResponse.json({ ok: true });
  } catch (err) {
    log.error("/api/alerts/webhook POST failed", err);
    return NextResponse.json({ error: "write failed" }, { status: 500 });
  }
}
