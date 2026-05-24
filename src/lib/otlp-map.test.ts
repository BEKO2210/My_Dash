import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import {
  aggregateCost,
  aggregateLatency,
  aggregateTokens,
  otlpAvailable,
  otlpCostMap,
  otlpSessionSummaries,
  percentile,
} from "@/lib/otlp-map";
import { insertLogs, insertMetrics, type OtlpLogRow, type OtlpMetricRow } from "@/lib/otlp";
import { migrate } from "@/lib/migrations";

let open: Database.Database | null = null;
afterEach(() => {
  open?.close();
  open = null;
});

const metric = (
  sessionId: string | null,
  name: string,
  value: number,
  attrs: Record<string, string | number | boolean> = {},
): OtlpMetricRow => ({ ts: null, name, sessionId, model: null, value, attrs });

const logRow = (
  sessionId: string | null,
  name: string,
  attrs: Record<string, string | number | boolean> = {},
): OtlpLogRow => ({ ts: null, name, sessionId, model: null, body: null, attrs });

describe("aggregateCost", () => {
  it("sums cost.usage per session and ignores other metrics/sessionless rows", () => {
    const out = aggregateCost([
      metric("s1", "claude_code.cost.usage", 0.5),
      metric("s1", "claude_code.cost.usage", 0.25),
      metric("s2", "claude_code.cost.usage", 1),
      metric("s1", "claude_code.token.usage", 100),
      metric(null, "claude_code.cost.usage", 9),
    ]);
    expect(out.get("s1")).toBeCloseTo(0.75);
    expect(out.get("s2")).toBe(1);
    expect(out.size).toBe(2);
  });
});

describe("aggregateTokens", () => {
  it("splits token.usage by the type attribute and tracks the total", () => {
    const out = aggregateTokens([
      metric("s1", "claude_code.token.usage", 1000, { type: "input" }),
      metric("s1", "claude_code.token.usage", 200, { type: "output" }),
      metric("s1", "claude_code.token.usage", 50, { type: "cacheRead" }),
      metric("s1", "claude_code.token.usage", 10, { type: "cacheCreation" }),
    ]);
    expect(out.get("s1")).toEqual({ input: 1000, output: 200, cacheRead: 50, cacheCreation: 10, total: 1260 });
  });
});

describe("percentile", () => {
  it("uses nearest-rank and handles the empty case", () => {
    expect(percentile([], 95)).toBe(0);
    expect(percentile([10, 20, 30, 40, 50, 60, 70, 80, 90, 100], 95)).toBe(100);
    expect(percentile([5], 50)).toBe(5);
  });
});

describe("aggregateLatency", () => {
  it("counts api_request events and computes avg + p95 from duration_ms", () => {
    const rows = [
      logRow("s1", "api_request", { duration_ms: 100 }),
      logRow("s1", "api_request", { duration_ms: 300 }),
      logRow("s1", "tool_result", { duration_ms: 9999 }),
      logRow("s1", "api_request", { duration_ms: -1 }),
    ];
    const out = aggregateLatency(rows);
    expect(out.get("s1")).toEqual({ count: 2, avgMs: 200, p95Ms: 300 });
  });
});

describe("DB readers", () => {
  it("maps stored OTLP rows into per-session summaries", () => {
    const db = (open = new Database(":memory:"));
    migrate(db);
    insertMetrics(
      [
        metric("s1", "claude_code.cost.usage", 0.4),
        metric("s1", "claude_code.token.usage", 1000, { type: "input" }),
        metric("s1", "claude_code.token.usage", 250, { type: "output" }),
      ],
      db,
    );
    insertLogs([logRow("s1", "api_request", { duration_ms: 120 })], db);

    const summaries = otlpSessionSummaries(db);
    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      sessionId: "s1",
      costUsd: 0.4,
      tokens: { input: 1000, output: 250, total: 1250 },
      latency: { count: 1, avgMs: 120, p95Ms: 120 },
    });

    expect(otlpCostMap(db).get("s1")).toBeCloseTo(0.4);
    expect(otlpAvailable(db)).toBe(true);
  });

  it("reports unavailable with no rows", () => {
    const db = (open = new Database(":memory:"));
    migrate(db);
    expect(otlpAvailable(db)).toBe(false);
    expect(otlpSessionSummaries(db)).toEqual([]);
    expect(otlpCostMap(db).size).toBe(0);
  });
});
