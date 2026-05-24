import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { computeBudget, dayElapsedFraction, gaugeTone, getBudgets, monthElapsedFraction, projectSpend } from "@/lib/budget";
import { setConfig } from "@/lib/config";
import { migrate } from "@/lib/migrations";
import type { UsageReport } from "@/lib/ccusage";

const ENV = { ...process.env };
let open: Database.Database | null = null;
afterEach(() => {
  open?.close();
  open = null;
  process.env = { ...ENV };
});

function report(over: Partial<UsageReport> = {}): UsageReport {
  return {
    days: [],
    months: [],
    blocks: [],
    burn: null,
    models: [],
    totals: { inputTokens: 0, outputTokens: 0, cacheTokens: 0, totalTokens: 0, costUsd: 0, costEur: 0 },
    available: true,
    ...over,
  };
}

const day = (date: string, costUsd: number) => ({
  date,
  inputTokens: 0,
  outputTokens: 0,
  cacheTokens: 0,
  totalTokens: 0,
  costUsd,
  costEur: 0,
});

describe("getBudgets", () => {
  it("reads from env and prefers config when set", () => {
    const db = (open = new Database(":memory:"));
    migrate(db);
    process.env.MC_BUDGET_DAILY = "5";
    process.env.MC_BUDGET_MONTHLY = "100";
    expect(getBudgets(db)).toEqual({ dailyUsd: 5, monthlyUsd: 100 });

    setConfig(db, "budget.daily", "8");
    expect(getBudgets(db).dailyUsd).toBe(8); // config overrides env
  });

  it("treats unset/invalid values as null", () => {
    const db = (open = new Database(":memory:"));
    migrate(db);
    delete process.env.MC_BUDGET_DAILY;
    process.env.MC_BUDGET_MONTHLY = "-5";
    expect(getBudgets(db)).toEqual({ dailyUsd: null, monthlyUsd: null });
  });
});

describe("computeBudget", () => {
  const now = new Date("2026-05-23T12:00:00Z");

  it("computes % used from today's and this month's spend", () => {
    const r = report({ days: [day("2026-05-23", 2)], months: [day("2026-05", 40)] });
    const status = computeBudget(r, { dailyUsd: 5, monthlyUsd: 100 }, now);
    expect(status.daily).toEqual({ budgetUsd: 5, spentUsd: 2, pct: 0.4 });
    expect(status.monthly).toEqual({ budgetUsd: 100, spentUsd: 40, pct: 0.4 });
  });

  it("reports null pct when no budget is set and zero spend when no rows", () => {
    const status = computeBudget(report(), { dailyUsd: null, monthlyUsd: null }, now);
    expect(status.daily).toEqual({ budgetUsd: null, spentUsd: 0, pct: null });
    expect(status.monthly).toEqual({ budgetUsd: null, spentUsd: 0, pct: null });
  });
});

describe("projectSpend", () => {
  it("projects end-of-period spend from elapsed fraction and flags over-budget", () => {
    // half the period gone, $60 spent → projected $120 > $100 budget.
    const p = projectSpend(60, 100, 0.5);
    expect(p.projectedUsd).toBe(120);
    expect(p.projectedPct).toBe(1.2);
    expect(p.overBudget).toBe(true);
  });

  it("does not flag when under budget or no budget", () => {
    expect(projectSpend(30, 100, 0.5).overBudget).toBe(false);
    expect(projectSpend(60, null, 0.5).overBudget).toBe(false);
  });

  it("suppresses noisy early projections below minFraction", () => {
    // $5 in the first 2% of the period would project huge, but it's too early.
    expect(projectSpend(5, 100, 0.02).overBudget).toBe(false);
  });
});

describe("elapsed fractions", () => {
  it("computes day fraction from local time", () => {
    expect(dayElapsedFraction(new Date(2026, 4, 24, 12, 0, 0))).toBeCloseTo(0.5);
  });

  it("computes month fraction from day of month", () => {
    // 2026-05 has 31 days; on the 16th ~ (15 + 0.5)/31.
    expect(monthElapsedFraction(new Date(2026, 4, 16, 12, 0, 0))).toBeCloseTo((15 + 0.5) / 31, 3);
  });
});

describe("gaugeTone", () => {
  it("is ok below 75% of budget", () => {
    expect(gaugeTone(0)).toBe("ok");
    expect(gaugeTone(0.5)).toBe("ok");
    expect(gaugeTone(0.7499)).toBe("ok");
  });

  it("warns from 75% up to the budget", () => {
    expect(gaugeTone(0.75)).toBe("warn");
    expect(gaugeTone(0.99)).toBe("warn");
  });

  it("flags over once the budget is reached or exceeded", () => {
    expect(gaugeTone(1)).toBe("over");
    expect(gaugeTone(1.5)).toBe("over");
  });
});
