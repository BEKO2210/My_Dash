import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildBranchCorrelations, type SessionGitRow } from "@/lib/git-correlation";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Sessions grouped by branch, with repo / branch / "open PR" links derived locally
// from each session's git origin remote. Read-only; no network or API tokens.
export async function GET() {
  try {
    const rows = db
      .prepare(
        `SELECT id, title, branch, remote_url, project_name, last_seen
         FROM sessions
         WHERE branch IS NOT NULL AND branch <> ''
         ORDER BY datetime(last_seen) DESC
         LIMIT 500`,
      )
      .all() as SessionGitRow[];
    return NextResponse.json({ branches: buildBranchCorrelations(rows) });
  } catch (err) {
    log.error("/api/git/branches failed", err);
    return NextResponse.json({ branches: [] });
  }
}
