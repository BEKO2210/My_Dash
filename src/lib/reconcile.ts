import type { UsageSession } from "./ccusage";

// Reconcile the transcript-derived per-session cost (a local estimate) against the
// two authoritative sources: ccusage (parsed from the official JSONL) and, when the
// optional OTLP receiver is enabled, Claude Code's own self-reported cost.usage.
// Preference order: ccusage > otlp > transcript. The discrepancy (preferred minus
// our estimate) is surfaced so the estimate can be sanity-checked.
export type CostSource = "ccusage" | "otlp" | "transcript";

export interface SessionCost {
  sessionId: string;
  transcriptUsd: number;
  ccusageUsd: number | null;
  otlpUsd: number | null;
  costUsd: number; // preferred figure
  source: CostSource;
  discrepancyUsd: number | null; // preferred - transcript, null when only the transcript estimate exists
}

export function reconcileSession(
  sessionId: string,
  transcriptUsd: number,
  ccusageUsd: number | null,
  otlpUsd: number | null = null,
): SessionCost {
  let costUsd = transcriptUsd;
  let source: CostSource = "transcript";
  if (ccusageUsd != null) {
    costUsd = ccusageUsd;
    source = "ccusage";
  } else if (otlpUsd != null) {
    costUsd = otlpUsd;
    source = "otlp";
  }
  return {
    sessionId,
    transcriptUsd,
    ccusageUsd,
    otlpUsd,
    costUsd,
    source,
    discrepancyUsd: source === "transcript" ? null : costUsd - transcriptUsd,
  };
}

export function reconcileSessions(
  sessions: { id: string; cost_usd: number }[],
  ccusage: UsageSession[],
  otlpCost?: Map<string, number>,
): SessionCost[] {
  const byId = new Map(ccusage.map((s) => [s.sessionId, s.costUsd]));
  return sessions.map((s) =>
    reconcileSession(
      s.id,
      s.cost_usd,
      byId.has(s.id) ? (byId.get(s.id) as number) : null,
      otlpCost?.get(s.id) ?? null,
    ),
  );
}
