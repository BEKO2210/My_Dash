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

// Gauge severity from fraction-of-budget used: green under 75%, amber from 75%,
// red once the budget is reached or exceeded. Kept pure so the thresholds are
// unit-tested independently of the widget.
export type GaugeTone = "ok" | "warn" | "over";
export function gaugeTone(pct: number): GaugeTone {
  if (pct >= 1) return "over";
  if (pct >= 0.75) return "warn";
  return "ok";
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

// ── Burn-rate projection / cost alarm ───────────────────────────────────────
export interface BudgetProjection {
  projectedUsd: number; // linear projection of end-of-period spend
  budgetUsd: number | null;
  projectedPct: number | null;
  overBudget: boolean;
}

export function dayElapsedFraction(now: Date): number {
  return (now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()) / 86_400;
}

export function monthElapsedFraction(now: Date): number {
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return (now.getDate() - 1 + now.getHours() / 24) / daysInMonth;
}

// Project end-of-period spend from how much of the period has elapsed. Only flags
// over-budget once enough of the period has passed (minFraction) to avoid noisy
// early projections.
export function projectSpend(
  spentUsd: number,
  budgetUsd: number | null,
  elapsedFraction: number,
  minFraction = 0.1,
): BudgetProjection {
  const f = Math.min(1, Math.max(0, elapsedFraction));
  const projectedUsd = f > 0 ? spentUsd / f : 0;
  const hasBudget = budgetUsd != null && budgetUsd > 0;
  return {
    projectedUsd,
    budgetUsd,
    projectedPct: hasBudget ? projectedUsd / budgetUsd! : null,
    overBudget: hasBudget && f >= minFraction && projectedUsd > budgetUsd!,
  };
}

export interface BudgetProjections {
  daily: BudgetProjection;
  monthly: BudgetProjection;
}

export function budgetProjections(status: BudgetStatus, now: Date = new Date()): BudgetProjections {
  return {
    daily: projectSpend(status.daily.spentUsd, status.daily.budgetUsd, dayElapsedFraction(now)),
    monthly: projectSpend(status.monthly.spentUsd, status.monthly.budgetUsd, monthElapsedFraction(now)),
  };
}
