import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mcpServerUsage } from "@/lib/mcp-servers";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Activity per MCP server (call volume, error rate, latency), busiest first.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(Math.max(Math.trunc(Number(url.searchParams.get("limit")) || 50), 1), 200);
  try {
    return NextResponse.json({ servers: mcpServerUsage(db, limit) });
  } catch (err) {
    log.error("/api/mcp failed", err);
    return NextResponse.json({ servers: [] });
  }
}
