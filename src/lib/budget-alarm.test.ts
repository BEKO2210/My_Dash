// Pin UTC so dayElapsedFraction (local-time based) is deterministic in CI.
process.env.TZ = "UTC";

import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { budgetAlarmFires, checkBudgetAlarms } from "@/lib/budget-alarm";
import { dayElapsedFraction, type BudgetProjection, type BudgetProjections } from "@/lib/budget";
import { setConfig } from "@/lib/config";
import { migrate } from "@/lib/migrations";

const ENV = { ...process.env };
let open: Database.Database | null = null;
afterEach(() => {
  open?.close();
  open = null;
  process.env = { ...ENV };
});

function freshDb(): Database.Database {
  const db = (open = new Database(":memory:"));
  migrate(db);
  return db;
}
const alertCount = (db: Database.Database) =>
  (db.prepare("SELECT COUNT(*) AS n FROM alerts").get() as { n: number }).n;
let sid = 0;
function addSession(db: Database.Database, costUsd: number, firstSeen: string): void {
  db.prepare("INSERT INTO sessions (id, cost_usd, first_seen) VALUES (?, ?, ?)").run(
    `s${sid++}`,
    costUsd,
    firstSeen,
  );
}
const proj = (overBudget: boolean, projectedUsd: number, budgetUsd: number | null): BudgetProjection => ({
  projectedUsd,
  budgetUsd,
  projectedPct: budgetUsd ? projectedUsd / budgetUsd : null,
  overBudget,
});

describe("budgetAlarmFires (pure)", () => {
  it("raises an over-budget projection with the right dedup key + message", () => {
    const p: BudgetProjections = { daily: proj(true, 40, 10), monthly: proj(false, 5, 100) };
    const fires = budgetAlarmFires(p, "2026-05-25");
    expect(fires).toHaveLength(1);
    expect(fires[0].type).toBe("cost_projection");
    expect(fires[0].dedupKey).toBe("cost:daily:2026-05-25");
    expect(fires[0].message).toBe("Projected daily spend $40.00 over $10 budget");
  });

  it("raises both daily and monthly when both are over", () => {
    const p: BudgetProjections = { daily: proj(true, 40, 10), monthly: proj(true, 300, 100) };
    expect(budgetAlarmFires(p, "2026-05-25")).toHaveLength(2);
  });

  it("raises nothing when under budget or no budget is set", () => {
    expect(budgetAlarmFires({ daily: proj(false, 5, 10), monthly: proj(false, 5, 100) }, "d")).toEqual([]);
    // overBudget true but no budget value → skip (defensive)
    expect(budgetAlarmFires({ daily: proj(true, 40, null), monthly: proj(true, 40, null) }, "d")).toEqual([]);
  });
});

describe("checkBudgetAlarms (writer)", () => {
  it("sanity: UTC is pinned so the day fraction is deterministic", () => {
    expect(dayElapsedFraction(new Date("2026-05-25T12:00:00Z"))).toBeCloseTo(0.5, 5);
  });

  it("no-ops (no write) when no budget is configured", () => {
    const db = freshDb();
    addSession(db, 100, "2026-05-25 01:00:00");
    expect(checkBudgetAlarms(db, new Date("2026-05-25T12:00:00Z"))).toEqual([]);
    expect(alertCount(db)).toBe(0);
  });

  it("records a deduped daily alarm when local spend projects over budget", () => {
    const db = freshDb();
    setConfig(db, "budget.daily", "10");
    const now = new Date("2026-05-25T12:00:00Z"); // 50% of the day elapsed
    addSession(db, 20, "2026-05-25 01:00:00"); // spent 20 at 50% → projected 40 > 10
    const raised = checkBudgetAlarms(db, now);
    expect(raised).toHaveLength(1);
    expect(raised[0].type).toBe("cost_projection");
    expect(alertCount(db)).toBe(1);
    // Idempotent within the same day — dedup keeps it from spamming.
    expect(checkBudgetAlarms(db, now)).toEqual([]);
    expect(alertCount(db)).toBe(1);
  });

  it("does not alarm when spend is within budget", () => {
    const db = freshDb();
    setConfig(db, "budget.daily", "100");
    const now = new Date("2026-05-25T12:00:00Z");
    addSession(db, 1, "2026-05-25 01:00:00");
    expect(checkBudgetAlarms(db, now)).toEqual([]);
    expect(alertCount(db)).toBe(0);
  });
});
