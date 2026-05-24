import type Database from "better-sqlite3";
import { db as defaultDb } from "./db";
import type { OtlpLogRow, OtlpMetricRow } from "./otlp";

// Map the isolated OTLP rows (received in a prior run) onto the dashboard's data
// model: per-session cost, token breakdown, and request latency. Pure aggregators
// (testable) plus thin DB readers. The OTLP path stays read-only and isolated — this
// only reads the otlp_* tables; the per-session cost feeds the cost reconciliation.

export const OTLP_COST_METRIC = "claude_code.cost.usage";
export const OTLP_TOKEN_METRIC = "claude_code.token.usage";
export const OTLP_API_REQUEST = "api_request"; // log event.name

export interface OtlpTokens {
  input: number;
  output: number;
  cacheRead: number;
  cacheCreation: number;
  total: number;
}

export interface OtlpLatency {
  count: number;
  avgMs: number;
  p95Ms: number;
}

export interface OtlpSessionSummary {
  sessionId: string;
  costUsd: number;
  tokens: OtlpTokens;
  latency: OtlpLatency;
}

function emptyTokens(): OtlpTokens {
  return { input: 0, output: 0, cacheRead: 0, cacheCreation: 0, total: 0 };
}

function emptyLatency(): OtlpLatency {
  return { count: 0, avgMs: 0, p95Ms: 0 };
}

export function aggregateCost(rows: Pick<OtlpMetricRow, "sessionId" | "name" | "value">[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of rows) {
    if (r.name !== OTLP_COST_METRIC || !r.sessionId) continue;
    out.set(r.sessionId, (out.get(r.sessionId) ?? 0) + r.value);
  }
  return out;
}

export function aggregateTokens(
  rows: Pick<OtlpMetricRow, "sessionId" | "name" | "value" | "attrs">[],
): Map<string, OtlpTokens> {
  const out = new Map<string, OtlpTokens>();
  for (const r of rows) {
    if (r.name !== OTLP_TOKEN_METRIC || !r.sessionId) continue;
    const t = out.get(r.sessionId) ?? emptyTokens();
    switch (String(r.attrs?.type ?? "")) {
      case "input":
        t.input += r.value;
        break;
      case "output":
        t.output += r.value;
        break;
      case "cacheRead":
        t.cacheRead += r.value;
        break;
      case "cacheCreation":
        t.cacheCreation += r.value;
        break;
    }
    t.total += r.value;
    out.set(r.sessionId, t);
  }
  return out;
}

// Nearest-rank percentile (p in 0..100). Empty input -> 0.
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

export function aggregateLatency(rows: Pick<OtlpLogRow, "sessionId" | "name" | "attrs">[]): Map<string, OtlpLatency> {
  const samples = new Map<string, number[]>();
  for (const r of rows) {
    if (r.name !== OTLP_API_REQUEST || !r.sessionId) continue;
    const d = Number(r.attrs?.duration_ms);
    if (!Number.isFinite(d) || d < 0) continue;
    const arr = samples.get(r.sessionId) ?? [];
    arr.push(d);
    samples.set(r.sessionId, arr);
  }
  const out = new Map<string, OtlpLatency>();
  for (const [sid, arr] of samples) {
    const sum = arr.reduce((a, b) => a + b, 0);
    out.set(sid, { count: arr.length, avgMs: sum / arr.length, p95Ms: percentile(arr, 95) });
  }
  return out;
}

interface RawMetric {
  session_id: string | null;
  name: string;
  value: number;
  attrs: string | null;
}
interface RawLog {
  session_id: string | null;
  name: string;
  attrs: string | null;
}

function parseAttrs(s: string | null): Record<string, string | number | boolean> {
  if (!s) return {};
  try {
    const v: unknown = JSON.parse(s);
    return v && typeof v === "object" ? (v as Record<string, string | number | boolean>) : {};
  } catch {
    return {};
  }
}

export function otlpSessionSummaries(database: Database.Database = defaultDb): OtlpSessionSummary[] {
  const metricRows = (
    database.prepare("SELECT session_id, name, value, attrs FROM otlp_metric WHERE session_id IS NOT NULL").all() as RawMetric[]
  ).map((r) => ({ sessionId: r.session_id, name: r.name, value: r.value, attrs: parseAttrs(r.attrs) }));
  const logRows = (
    database.prepare("SELECT session_id, name, attrs FROM otlp_log WHERE session_id IS NOT NULL").all() as RawLog[]
  ).map((r) => ({ sessionId: r.session_id, name: r.name, attrs: parseAttrs(r.attrs) }));

  const cost = aggregateCost(metricRows);
  const tokens = aggregateTokens(metricRows);
  const latency = aggregateLatency(logRows);

  const ids = new Set<string>([...cost.keys(), ...tokens.keys(), ...latency.keys()]);
  return [...ids].map((sessionId) => ({
    sessionId,
    costUsd: cost.get(sessionId) ?? 0,
    tokens: tokens.get(sessionId) ?? emptyTokens(),
    latency: latency.get(sessionId) ?? emptyLatency(),
  }));
}

// Per-session OTLP cost, for folding into the cost reconciliation.
export function otlpCostMap(database: Database.Database = defaultDb): Map<string, number> {
  const rows = database
    .prepare("SELECT session_id, value FROM otlp_metric WHERE name = ? AND session_id IS NOT NULL")
    .all(OTLP_COST_METRIC) as { session_id: string; value: number }[];
  const out = new Map<string, number>();
  for (const r of rows) out.set(r.session_id, (out.get(r.session_id) ?? 0) + r.value);
  return out;
}

export function otlpAvailable(database: Database.Database = defaultDb): boolean {
  const m = database.prepare("SELECT 1 FROM otlp_metric LIMIT 1").get();
  const l = database.prepare("SELECT 1 FROM otlp_log LIMIT 1").get();
  return Boolean(m || l);
}
