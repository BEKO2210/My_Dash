import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUsage } from "@/lib/ccusage";
import { projectUsage, reconciledProjectCostUsd } from "@/lib/projects";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cost/tokens/sessions aggregated by project. Cost is reconciled to ccusage (the
// source of truth) per session so it matches the rest of the economy view instead
// of the inflated raw transcript estimate; falls back to the estimate when ccusage
// is unavailable.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(Math.max(Math.trunc(Number(url.searchParams.get("limit")) || 100), 1), 500);
  try {
    const projects = projectUsage(db, limit);
    const usage = await getSessionUsage();
    if (usage.available) {
      const costByProject = reconciledProjectCostUsd(db, usage.sessions);
      for (const p of projects) {
        p.costUsd = +(costByProject.get(p.project) ?? p.costUsd).toFixed(2);
      }
      // Reconciliation can reorder the ranking → re-sort by the reconciled cost.
      projects.sort((a, b) => b.costUsd - a.costUsd || b.sessions - a.sessions);
    }
    return NextResponse.json({ projects });
  } catch (err) {
    log.error("/api/usage/projects failed", err);
    return NextResponse.json({ projects: [] });
  }
}
