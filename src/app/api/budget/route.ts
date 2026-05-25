import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUsage } from "@/lib/ccusage";
import { budgetProjections, computeBudget, getBudgets } from "@/lib/budget";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Daily/monthly budget limits, how much of each is used, and a burn-rate
// projection. READ-ONLY: `projection.{daily,monthly}.overBudget` is the computed
// over-budget flag the UI renders. The inbox alarm for going over budget is a
// write, so it's raised on the ingest path (see lib/budget-alarm.ts) — never here,
// because a read route must not mutate the DB (the one-way data rule).
export async function GET() {
  try {
    const report = await getUsage();
    const budgets = getBudgets(db);
    const status = computeBudget(report, budgets);
    const projection = budgetProjections(status);
    return NextResponse.json({ budgets, status, projection });
  } catch (err) {
    log.error("/api/budget failed", err);
    const empty = { budgetUsd: null, spentUsd: 0, pct: null };
    const emptyProj = { projectedUsd: 0, budgetUsd: null, projectedPct: null, overBudget: false };
    return NextResponse.json({
      budgets: { dailyUsd: null, monthlyUsd: null },
      status: { daily: empty, monthly: empty },
      projection: { daily: emptyProj, monthly: emptyProj },
    });
  }
}
