import type Database from "better-sqlite3";
import { recordAlert, type AlertFire } from "./alerts";
import {
  budgetProjections,
  getBudgets,
  type BudgetProjections,
  type Budgets,
  type BudgetStatus,
} from "./budget";

// Budget-over-spend alarm. This is a *write* (it records an inbox alert), so it
// lives on the ingest write path — NEVER on the read-only `/api/budget` GET, which
// must not mutate the DB (the one-way data rule). Spend comes from the local
// session costs (the same source the digest uses): a single indexed SUM, cheap
// enough for the write path and needing no ccusage exec. ccusage stays the source
// of truth for the read-only budget *view*; this only drives the alarm.

function periodSpendUsd(db: Database.Database, sinceIso: string): number {
  return (
    db
      .prepare(`SELECT COALESCE(SUM(cost_usd), 0) AS n FROM sessions WHERE first_seen >= ?`)
      .get(sinceIso) as { n: number }
  ).n;
}

function localBudgetStatus(db: Database.Database, budgets: Budgets, now: Date): BudgetStatus {
  const dayStart = now.toISOString().slice(0, 10) + " 00:00:00";
  const monthStart = now.toISOString().slice(0, 7) + "-01 00:00:00";
  const u = (spentUsd: number, budgetUsd: number | null) => ({
    budgetUsd,
    spentUsd,
    pct: budgetUsd && budgetUsd > 0 ? spentUsd / budgetUsd : null,
  });
  return {
    daily: u(periodSpendUsd(db, dayStart), budgets.dailyUsd),
    monthly: u(periodSpendUsd(db, monthStart), budgets.monthlyUsd),
  };
}

// Pure: which budget alarms a projection should raise. Deduped per period+day so a
// firing condition records at most one alert per day. No DB access → unit-testable.
export function budgetAlarmFires(projection: BudgetProjections, day: string): AlertFire[] {
  const fires: AlertFire[] = [];
  for (const [period, proj] of [
    ["daily", projection.daily],
    ["monthly", projection.monthly],
  ] as const) {
    if (proj.overBudget && proj.budgetUsd != null) {
      fires.push({
        ruleId: 0,
        type: "cost_projection",
        sessionId: "",
        dedupKey: `cost:${period}:${day}`,
        message: `Projected ${period} spend $${proj.projectedUsd.toFixed(2)} over $${proj.budgetUsd.toFixed(0)} budget`,
      });
    }
  }
  return fires;
}

// Writer: evaluate budget projections from local spend and record any new
// over-budget alarms. Returns the alarms actually recorded (new, non-duplicate).
// Safe to call often — it no-ops when no budget is configured.
export function checkBudgetAlarms(db: Database.Database, now: Date = new Date()): AlertFire[] {
  const budgets = getBudgets(db);
  if (budgets.dailyUsd == null && budgets.monthlyUsd == null) return [];
  const projection = budgetProjections(localBudgetStatus(db, budgets, now), now);
  return budgetAlarmFires(projection, now.toISOString().slice(0, 10)).filter((f) =>
    recordAlert(db, f),
  );
}
