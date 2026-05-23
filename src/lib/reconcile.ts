import type { UsageSession } from "./ccusage";

// Reconcile the transcript-derived per-session cost (a local estimate) against
// ccusage's authoritative per-session cost: prefer ccusage when present, and
// surface the discrepancy so the estimate can be sanity-checked.
export type CostSource = "ccusage" | "transcript";

export interface SessionCost {
  sessionId: string;
  transcriptUsd: number;
  ccusageUsd: number | null;
  costUsd: number; // preferred figure
  source: CostSource;
  discrepancyUsd: number | null; // ccusage - transcript, null when ccusage absent
}

export function reconcileSession(
  sessionId: string,
  transcriptUsd: number,
  ccusageUsd: number | null,
): SessionCost {
  if (ccusageUsd != null) {
    return {
      sessionId,
      transcriptUsd,
      ccusageUsd,
      costUsd: ccusageUsd,
      source: "ccusage",
      discrepancyUsd: ccusageUsd - transcriptUsd,
    };
  }
  return {
    sessionId,
    transcriptUsd,
    ccusageUsd: null,
    costUsd: transcriptUsd,
    source: "transcript",
    discrepancyUsd: null,
  };
}

export function reconcileSessions(
  sessions: { id: string; cost_usd: number }[],
  ccusage: UsageSession[],
): SessionCost[] {
  const byId = new Map(ccusage.map((s) => [s.sessionId, s.costUsd]));
  return sessions.map((s) =>
    reconcileSession(s.id, s.cost_usd, byId.has(s.id) ? (byId.get(s.id) as number) : null),
  );
}
