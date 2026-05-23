import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projectUsage } from "@/lib/projects";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cost/tokens/sessions aggregated by project.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(Math.max(Math.trunc(Number(url.searchParams.get("limit")) || 100), 1), 500);
  try {
    return NextResponse.json({ projects: projectUsage(db, limit) });
  } catch (err) {
    log.error("/api/usage/projects failed", err);
    return NextResponse.json({ projects: [] });
  }
}
