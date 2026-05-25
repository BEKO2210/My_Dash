import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildDigest, renderDigestHtml, type DigestData, type DigestPeriod } from "@/lib/digest";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A zeroed digest so an error still yields a valid 200 response in the requested
// format (read routes degrade, never 5xx) instead of a broken page/JSON.
function emptyDigest(period: DigestPeriod): DigestData {
  const stamp = new Date().toISOString().replace("T", " ").slice(0, 19);
  return {
    period,
    since: stamp,
    generatedAt: stamp,
    events: 0,
    toolCalls: 0,
    failures: 0,
    sessions: 0,
    costUsd: 0,
    errorRate: 0,
    topTools: [],
    topErrors: [],
  };
}

// Daily/weekly digest. HTML by default (open in a tab / save / email); JSON with
// ?format=json.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const period: DigestPeriod = url.searchParams.get("period") === "week" ? "week" : "day";
  const format = url.searchParams.get("format") === "json" ? "json" : "html";
  const render = (data: DigestData) =>
    format === "json"
      ? NextResponse.json(data)
      : new NextResponse(renderDigestHtml(data), {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
  try {
    return render(buildDigest(db, period));
  } catch (err) {
    log.error("/api/digest failed", err);
    return render(emptyDigest(period)); // 200, valid-but-empty
  }
}
