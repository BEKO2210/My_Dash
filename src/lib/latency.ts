// Tool-latency distribution. Exponential buckets (latency is long-tailed) and
// percentiles (p50/p95/p99) rather than an average, which hides the tail.

export interface LatencyBucket {
  label: string;
  count: number;
}

export interface LatencyStats {
  count: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
  buckets: LatencyBucket[];
}

const EDGES = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000]; // ms (exponential-ish)

export function formatMs(n: number): string {
  return n >= 1000 ? `${+(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}s` : `${Math.round(n)}ms`;
}

// Nearest-rank percentile of an ascending array.
export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

function bucketize(values: number[]): LatencyBucket[] {
  const counts = new Array<number>(EDGES.length + 1).fill(0);
  for (const v of values) {
    let i = EDGES.findIndex((e) => v < e);
    if (i === -1) i = EDGES.length; // overflow
    counts[i]++;
  }
  return counts.map((count, i) => ({
    label: i < EDGES.length ? formatMs(EDGES[i]) : `${formatMs(EDGES[EDGES.length - 1])}+`,
    count,
  }));
}

export function latencyStats(values: number[]): LatencyStats {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    count: values.length,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    max: sorted.length ? sorted[sorted.length - 1] : 0,
    buckets: bucketize(values),
  };
}
