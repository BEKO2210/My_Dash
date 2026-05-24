import type Database from "better-sqlite3";
import { percentile } from "./latency";

// "Is Claude getting worse?" — compares a recent window (last 24h) against a
// baseline (the prior 7 days) for tool latency (p95) and error rate, flagging a
// metric as anomalous when it rises meaningfully above its baseline. Pure
// compareMetric so the threshold logic is unit-testable.

export interface MetricComparison {
  recent: number;
  baseline: number;
  deltaPct: number; // relative change vs baseline (0 when no baseline)
  anomalous: boolean;
}

export function compareMetric(recent: number, baseline: number, threshold = 0.5): MetricComparison {
  const deltaPct = baseline > 0 ? (recent - baseline) / baseline : 0;
  return { recent, baseline, deltaPct, anomalous: baseline > 0 && recent > baseline && deltaPct >= threshold };
}

export interface AnomalyReport {
  latencyMs: MetricComparison; // p95
  errorRate: MetricComparison; // 0..1
  recentSamples: number;
  baselineSamples: number;
}

function iso(ms: number): string {
  return new Date(ms).toISOString().replace("T", " ").slice(0, 19);
}

function durations(db: Database.Database, sql: string, args: unknown[]): number[] {
  return (db.prepare(sql).all(...args) as { duration_ms: number }[])
    .map((r) => r.duration_ms)
    .sort((a, b) => a - b);
}

function windowErrorRate(db: Database.Database, since: string, until: string | null): number {
  const cond = until ? `created_at >= ? AND created_at < ?` : `created_at >= ?`;
  const args = until ? [since, until] : [since];
  const row = db
    .prepare(
      `SELECT COUNT(*) AS total, SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) AS failures
       FROM tool_calls WHERE ${cond}`,
    )
    .get(...args) as { total: number; failures: number };
  return row.total ? row.failures / row.total : 0;
}

export function anomalyReport(db: Database.Database, now: Date = new Date()): AnomalyReport {
  const day = 86_400_000;
  const recentSince = iso(now.getTime() - day);
  const baseSince = iso(now.getTime() - 8 * day);

  const recentD = durations(
    db,
    `SELECT duration_ms FROM tool_calls WHERE duration_ms IS NOT NULL AND created_at >= ?`,
    [recentSince],
  );
  const baseD = durations(
    db,
    `SELECT duration_ms FROM tool_calls WHERE duration_ms IS NOT NULL AND created_at >= ? AND created_at < ?`,
    [baseSince, recentSince],
  );

  return {
    latencyMs: compareMetric(percentile(recentD, 95), percentile(baseD, 95)),
    errorRate: compareMetric(windowErrorRate(db, recentSince, null), windowErrorRate(db, baseSince, recentSince)),
    recentSamples: recentD.length,
    baselineSamples: baseD.length,
  };
}
