import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { computeBudget, getBudgets } from "@/lib/budget";
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
