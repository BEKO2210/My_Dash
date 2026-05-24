import { NextResponse } from "next/server";
import { buildOpenApiSpec } from "@/lib/openapi";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// OpenAPI 3.1 description of the whole HTTP surface (all read paths + the single
// write path). Read-only; the data hub's self-description.
export async function GET() {
  try {
    return NextResponse.json(buildOpenApiSpec());
  } catch (err) {
    log.error("/api/openapi failed", err);
    return NextResponse.json({ error: "spec unavailable" }, { status: 500 });
  }
}
