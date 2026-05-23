import { describe, expect, it } from "vitest";
import { reconcileSession, reconcileSessions } from "@/lib/reconcile";
import type { UsageSession } from "@/lib/ccusage";

const ccSession = (sessionId: string, costUsd: number): UsageSession => ({
  sessionId,
  models: [],
  inputTokens: 0,
  outputTokens: 0,
  cacheTokens: 0,
  totalTokens: 0,
  costUsd,
  costEur: 0,
  lastActivity: null,
});

describe("reconcileSession", () => {
  it("prefers ccusage and reports the discrepancy", () => {
    expect(reconcileSession("s1", 0.8, 1.0)).toEqual({
      sessionId: "s1",
      transcriptUsd: 0.8,
      ccusageUsd: 1.0,
      costUsd: 1.0,
      source: "ccusage",
      discrepancyUsd: expect.closeTo(0.2, 5),
    });
  });

  it("falls back to the transcript estimate when ccusage is absent", () => {
    expect(reconcileSession("s1", 0.8, null)).toEqual({
      sessionId: "s1",
      transcriptUsd: 0.8,
      ccusageUsd: null,
      costUsd: 0.8,
      source: "transcript",
      discrepancyUsd: null,
    });
  });
});

describe("reconcileSessions", () => {
  it("joins sessions to ccusage by id", () => {
    const sessions = [
      { id: "s1", cost_usd: 0.8 },
      { id: "s2", cost_usd: 0.5 },
    ];
    const result = reconcileSessions(sessions, [ccSession("s1", 1.0)]);
    expect(result[0]).toMatchObject({ source: "ccusage", costUsd: 1.0 });
    expect(result[1]).toMatchObject({ source: "transcript", costUsd: 0.5, ccusageUsd: null });
  });
});
