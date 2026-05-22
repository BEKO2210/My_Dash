import { NextResponse } from "next/server";
import { getUsage } from "@/lib/ccusage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Token & cost rollups from ccusage (30s server-side cache, USD + derived EUR).
export async function GET() {
  const usage = await getUsage();
  return NextResponse.json(usage);
}
