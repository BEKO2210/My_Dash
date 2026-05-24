import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildDigest, renderDigestHtml, type DigestPeriod } from "@/lib/digest";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Daily/weekly digest. HTML by default (open in a tab / save / email); JSON with
// ?format=json.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const period: DigestPeriod = url.searchParams.get("period") === "week" ? "week" : "day";
  const format = url.searchParams.get("format") === "json" ? "json" : "html";
  try {
    const data = buildDigest(db, period);
    if (format === "json") return NextResponse.json(data);
    return new NextResponse(renderDigestHtml(data), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (err) {
    log.error("/api/digest failed", err);
    return NextResponse.json({ error: "digest failed" }, { status: 500 });
  }
}
