import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUsage } from "@/lib/ccusage";
import { budgetProjections, computeBudget, getBudgets, type BudgetProjection } from "@/lib/budget";
import { recordAlert } from "@/lib/alerts";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Raise a cost alarm into the inbox when a period's burn projects over budget.
// Deduped per period/day so it fires at most once a day.
function raiseAlarm(period: "daily" | "monthly", proj: BudgetProjection): void {
  if (!proj.overBudget || proj.budgetUsd == null) return;
  const day = new Date().toISOString().slice(0, 10);
  recordAlert(db, {
    ruleId: 0,
    type: "cost_projection",
    sessionId: "",
    dedupKey: `cost:${period}:${day}`,
    message: `Projected ${period} spend $${proj.projectedUsd.toFixed(2)} over $${proj.budgetUsd.toFixed(0)} budget`,
  });
}

// Daily/monthly budget limits, how much of each is used, and a burn-rate projection.
export async function GET() {
  try {
    const report = await getUsage();
    const budgets = getBudgets(db);
    const status = computeBudget(report, budgets);
    const projection = budgetProjections(status);
    try {
      raiseAlarm("daily", projection.daily);
      raiseAlarm("monthly", projection.monthly);
    } catch (err) {
      log.error("cost alarm failed", err);
    }
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
