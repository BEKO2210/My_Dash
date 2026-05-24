import { db } from "@/lib/db";
import { collectMetrics, PROM_CONTENT_TYPE, renderPrometheus } from "@/lib/prometheus";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Prometheus scrape endpoint (text exposition format 0.0.4). Read-only and local-only
// (the server binds 127.0.0.1), so Grafana/Prometheus can scrape the same machine.
export async function GET() {
  try {
    const body = renderPrometheus(collectMetrics(db));
    return new Response(body, { headers: { "Content-Type": PROM_CONTENT_TYPE } });
  } catch (err) {
    log.error("/api/metrics failed", err);
    return new Response("# metrics unavailable\n", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
