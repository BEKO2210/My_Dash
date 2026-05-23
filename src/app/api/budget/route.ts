import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUsage } from "@/lib/ccusage";
import { computeBudget, getBudgets } from "@/lib/budget";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Daily/monthly budget limits and how much of each is used so far.
export async function GET() {
  try {
    const report = await getUsage();
    const budgets = getBudgets(db);
    return NextResponse.json({ budgets, status: computeBudget(report, budgets) });
  } catch (err) {
    log.error("/api/budget failed", err);
    const empty = { budgetUsd: null, spentUsd: 0, pct: null };
    return NextResponse.json({
      budgets: { dailyUsd: null, monthlyUsd: null },
      status: { daily: empty, monthly: empty },
    });
  }
}
