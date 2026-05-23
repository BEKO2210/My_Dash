import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { collectHealth } from "@/lib/health";
import pkg from "../../../../package.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Liveness/status probe: DB reachability, schema version, row counts, uptime and
// app version. Used by Electron's startup wait and any future monitoring. 503 when
// the database can't be read.
export async function GET() {
  const report = collectHealth(db, {
    version: pkg.version,
    uptimeSec: Math.round(process.uptime()),
  });
  return NextResponse.json(report, { status: report.ok ? 200 : 503 });
}
