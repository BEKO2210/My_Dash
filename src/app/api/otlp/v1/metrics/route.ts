import { NextResponse } from "next/server";
import { insertMetrics, otlpEnabled, parseMetrics } from "@/lib/otlp";
import { readBodyCapped } from "@/lib/body-limit";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY = 8 * 1024 * 1024;

// Optional SECOND read-only ingress (OTLP/HTTP, JSON). Off unless MC_OTLP_ENABLED=1.
// Point Claude Code's exporter at it with:
//   export OTEL_EXPORTER_OTLP_PROTOCOL=http/json
//   export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:3000/api/otlp
// Same trust model as /api/ingest: the server binds 127.0.0.1, so this is local-only.
export async function POST(req: Request) {
  if (!otlpEnabled()) {
    return NextResponse.json({ error: "otlp disabled" }, { status: 404 });
  }
  const capped = await readBodyCapped(req, MAX_BODY);
  if (!capped.ok) {
    return NextResponse.json({ error: "payload too large" }, { status: 413 });
  }
  let body: unknown;
  try {
    body = capped.text ? JSON.parse(capped.text) : {};
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  try {
    insertMetrics(parseMetrics(body));
    // OTLP/HTTP success: an (empty) ExportMetricsServiceResponse.
    return NextResponse.json({ partialSuccess: {} });
  } catch (err) {
    log.error("/api/otlp/v1/metrics failed", err);
    return NextResponse.json({ error: "store failed" }, { status: 500 });
  }
}
