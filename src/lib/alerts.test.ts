import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { migrate } from "@/lib/migrations";
import { evaluateRules, processAlerts, recentAlerts, type Rule, type RuleCtx } from "@/lib/alerts";
import { translate } from "@/lib/i18n";

const placeholders = (s: string): string[] => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);

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

  it("attaches localization params per rule type (#30)", () => {
    const [mcp] = evaluateRules(ctx({ toolSuccess: 0, toolName: "mcp__github__x" }), [rule({ type: "mcp_error" })]);
    expect(mcp.params).toEqual({ tool: "mcp__github__x" });

    const [spike] = evaluateRules(ctx({ recentErrorRate: 0.3 }), [rule({ type: "error_spike", threshold: 0.25 })]);
    expect(spike.params).toEqual({ rate: 30, threshold: 25 }); // already-rounded %

    const [long] = evaluateRules(ctx({ sessionDurationMin: 130 }), [rule({ type: "session_long", threshold: 120 })]);
    expect(long.params).toEqual({ minutes: 130, threshold: 120 }); // matches i18n {minutes}

    const [cost] = evaluateRules(ctx({ sessionCostUsd: 6 }), [rule({ type: "cost_session", threshold: 5 })]);
    expect(cost.params).toEqual({ cost: "6.00", threshold: 5 });
  });

  // Cross-domain contract guard: the params Forge emits must cover every {placeholder}
  // in Prism's i18n templates, in both languages — catches drift like min vs minutes.
  it("emitted params cover every placeholder in the alert i18n templates (#30 contract)", () => {
    const cases: { type: string; rule: Rule; ctx: RuleCtx }[] = [
      { type: "mcp_error", rule: rule({ type: "mcp_error" }), ctx: ctx({ toolSuccess: 0, toolSource: "mcp" }) },
      { type: "error_spike", rule: rule({ type: "error_spike", threshold: 0.25 }), ctx: ctx({ recentErrorRate: 0.5 }) },
      { type: "session_long", rule: rule({ type: "session_long", threshold: 120 }), ctx: ctx({ sessionDurationMin: 130 }) },
      { type: "cost_session", rule: rule({ type: "cost_session", threshold: 5 }), ctx: ctx({ sessionCostUsd: 9 }) },
    ];
    for (const { type, rule: r, ctx: c } of cases) {
      const [fire] = evaluateRules(c, [r]);
      expect(fire, type).toBeTruthy();
      const keys = Object.keys(fire.params ?? {});
      for (const lang of ["en", "de"] as const) {
        for (const ph of placeholders(translate(lang, `alert.${type}`))) {
          expect(keys, `${lang} alert.${type} needs param {${ph}}`).toContain(ph);
        }
      }
    }
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
    expect(processAlerts(db, c).length).toBeGreaterThan(0);
    expect(processAlerts(db, c)).toHaveLength(0); // same session → deduped
    const alerts = recentAlerts(db, 10);
    expect(alerts.some((a) => a.type === "cost_session")).toBe(true);
    // params round-trip through the DB (stored as JSON, parsed on read).
    const cost = alerts.find((a) => a.type === "cost_session")!;
    expect(cost.params).toEqual({ cost: "9.00", threshold: 5 });
  });
});
