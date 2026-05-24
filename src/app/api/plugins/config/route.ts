import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getAllPluginConfig, setPluginConfig } from "@/lib/plugin-config";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Per-plugin settings. GET returns every plugin's config; POST upserts one. This
// is a deliberately small, local write path (settings only) — distinct from the
// hook ingest path, validated and size-bounded.
export async function GET() {
  try {
    return NextResponse.json({ config: getAllPluginConfig(db) });
  } catch (err) {
    log.error("/api/plugins/config GET failed", err);
    return NextResponse.json({ config: {} });
  }
}

const Body = z.object({
  pluginId: z.string().min(1).max(64),
  config: z.record(z.string(), z.unknown()),
});

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = Body.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid body" }, { status: 400 });
    }
    if (JSON.stringify(parsed.data.config).length > 8000) {
      return NextResponse.json({ error: "config too large" }, { status: 413 });
    }
    setPluginConfig(db, parsed.data.pluginId, parsed.data.config);
    return NextResponse.json({ ok: true });
  } catch (err) {
    log.error("/api/plugins/config POST failed", err);
    return NextResponse.json({ error: "write failed" }, { status: 500 });
  }
}
