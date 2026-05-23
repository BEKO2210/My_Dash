import type Database from "better-sqlite3";
import type { UsageReport } from "./ccusage";
import { getConfig } from "./config";

// Spend budgets in USD (ccusage reports USD; the UI converts to EUR for display).
// Configured via the config table (budget.daily / budget.monthly), falling back to
// MC_BUDGET_DAILY / MC_BUDGET_MONTHLY.
export interface Budgets {
  dailyUsd: number | null;
  monthlyUsd: number | null;
}

export interface BudgetUsage {
  budgetUsd: number | null;
  spentUsd: number;
  pct: number | null; // 0..1, null when no budget set
}

export interface BudgetStatus {
  daily: BudgetUsage;
  monthly: BudgetUsage;
}

function positive(s: string | null | undefined): number | null {
  if (s == null) return null;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function getBudgets(db: Database.Database): Budgets {
  return {
    dailyUsd: positive(getConfig(db, "budget.daily") ?? process.env.MC_BUDGET_DAILY),
    monthlyUsd: positive(getConfig(db, "budget.monthly") ?? process.env.MC_BUDGET_MONTHLY),
  };
}

const usage = (spentUsd: number, budgetUsd: number | null): BudgetUsage => ({
  budgetUsd,
  spentUsd,
  pct: budgetUsd && budgetUsd > 0 ? spentUsd / budgetUsd : null,
});

// % of budget used = today's spend vs daily budget, this month's vs monthly.
export function computeBudget(
  report: UsageReport,
  budgets: Budgets,
  now: Date = new Date(),
): BudgetStatus {
  const today = now.toISOString().slice(0, 10);
  const month = now.toISOString().slice(0, 7);
  const todaySpent = report.days.find((d) => d.date === today)?.costUsd ?? 0;
  const monthSpent = report.months.find((m) => m.date === month)?.costUsd ?? 0;
  return {
    daily: usage(todaySpent, budgets.dailyUsd),
    monthly: usage(monthSpent, budgets.monthlyUsd),
  };
}
