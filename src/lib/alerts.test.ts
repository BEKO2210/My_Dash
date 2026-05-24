import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { migrate } from "@/lib/migrations";
import { evaluateRules, processAlerts, recentAlerts, type Rule, type RuleCtx } from "@/lib/alerts";

const rule = (over: Partial<Rule> = {}): Rule => ({ id: 1, type: "mcp_error", threshold: 0, enabled: 1, label: null, ...over });

const ctx = (over: Partial<RuleCtx> = {}): RuleCtx => ({
  eventType: "PostToolUse",
  toolName: "mcp__github__x",
  toolSource: "mcp",
  toolSuccess: 1,
  sessionId: "s1",
  sessionCostUsd: 0,
  sessionDurationMin: 0,
  recentErrorRate: 0,
  hourBucket: "2026-05-24 10",
  ...over,
});

describe("evaluateRules", () => {
  it("fires mcp_error only on a failed MCP PostToolUse", () => {
    const rules = [rule({ type: "mcp_error" })];
    expect(evaluateRules(ctx({ toolSuccess: 0 }), rules)).toHaveLength(1);
    expect(evaluateRules(ctx({ toolSuccess: 1 }), rules)).toHaveLength(0);
    expect(evaluateRules(ctx({ toolSuccess: 0, toolSource: "builtin" }), rules)).toHaveLength(0);
  });

  it("fires error_spike at/above the threshold", () => {
    const rules = [rule({ type: "error_spike", threshold: 0.25 })];
    expect(evaluateRules(ctx({ recentErrorRate: 0.3 }), rules)).toHaveLength(1);
    expect(evaluateRules(ctx({ recentErrorRate: 0.1 }), rules)).toHaveLength(0);
  });

  it("fires session_long and cost_session by threshold", () => {
    expect(evaluateRules(ctx({ sessionDurationMin: 130 }), [rule({ type: "session_long", threshold: 120 })])).toHaveLength(1);
    expect(evaluateRules(ctx({ sessionCostUsd: 6 }), [rule({ type: "cost_session", threshold: 5 })])).toHaveLength(1);
    expect(evaluateRules(ctx({ sessionCostUsd: 2 }), [rule({ type: "cost_session", threshold: 5 })])).toHaveLength(0);
  });

  it("skips disabled rules", () => {
    expect(evaluateRules(ctx({ toolSuccess: 0 }), [rule({ enabled: 0 })])).toHaveLength(0);
  });
});

describe("processAlerts (dedup)", () => {
  let open: Database.Database | null = null;
  afterEach(() => {
    open?.close();
    open = null;
  });

  it("records an alert once per dedup key", () => {
    const db = (open = new Database(":memory:"));
    migrate(db); // seeds default rules incl. cost_session @ 5
    const c = ctx({ eventType: "Stop", sessionCostUsd: 9 });
    expect(processAlerts(db, c)).toBeGreaterThan(0);
    expect(processAlerts(db, c)).toBe(0); // same session → deduped
    const alerts = recentAlerts(db, 10);
    expect(alerts.some((a) => a.type === "cost_session")).toBe(true);
  });
});
