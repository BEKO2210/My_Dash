import type Database from "better-sqlite3";
import { percentile } from "./latency";
import { formatDuration } from "./format";

// Session-length distribution: each session's wall-clock span (last_seen −
// first_seen). Long-tailed, so fixed time buckets + percentiles rather than a mean.

export interface DurationBucket {
  label: string;
  count: number;
}

export interface DurationStats {
  count: number;
  median: number; // ms
  p95: number; // ms
  max: number; // ms
  buckets: DurationBucket[];
}

const EDGES_MS = [1, 5, 15, 30, 60, 120, 240].map((m) => m * 60_000);

function bucketize(values: number[]): DurationBucket[] {
  const counts = new Array<number>(EDGES_MS.length + 1).fill(0);
  for (const v of values) {
    let i = EDGES_MS.findIndex((e) => v < e);
    if (i === -1) i = EDGES_MS.length;
    counts[i]++;
  }
  return counts.map((count, i) => ({
    label: i < EDGES_MS.length ? `<${formatDuration(EDGES_MS[i])}` : `${formatDuration(EDGES_MS[EDGES_MS.length - 1])}+`,
    count,
  }));
}

export function durationStats(values: number[]): DurationStats {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    count: values.length,
    median: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    max: sorted.length ? sorted[sorted.length - 1] : 0,
    buckets: bucketize(values),
  };
}

// Per-session durations in ms (only sessions with a positive span).
export function sessionDurationsMs(db: Database.Database, limit = 5000): number[] {
  const rows = db
    .prepare(
      `SELECT (julianday(last_seen) - julianday(first_seen)) * 86400000 AS ms
       FROM sessions
       WHERE last_seen IS NOT NULL AND first_seen IS NOT NULL
       ORDER BY first_seen DESC
       LIMIT ?`,
    )
    .all(limit) as { ms: number | null }[];
  return rows.map((r) => Math.round(r.ms ?? 0)).filter((ms) => ms > 0);
}
