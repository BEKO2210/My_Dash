import type Database from "better-sqlite3";

// Prometheus text exposition format (version 0.0.4) so Grafana/Prometheus can scrape
// the dashboard's aggregates alongside the OTLP path. Read-only and local-only (the
// server binds 127.0.0.1). The renderer is pure; collectMetrics does the DB reads.

export type PromType = "counter" | "gauge";

export interface PromSample {
  value: number;
  labels?: Record<string, string>;
}

export interface PromMetric {
  name: string;
  help: string;
  type: PromType;
  samples: PromSample[];
}

export const PROM_CONTENT_TYPE = "text/plain; version=0.0.4; charset=utf-8";

function escapeHelp(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n");
}

function escapeLabelValue(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

function formatLabels(labels?: Record<string, string>): string {
  if (!labels) return "";
  const parts = Object.entries(labels).map(([k, v]) => `${k}="${escapeLabelValue(String(v))}"`);
  return parts.length ? `{${parts.join(",")}}` : "";
}

function formatValue(v: number): string {
  if (Number.isNaN(v)) return "NaN";
  if (v === Infinity) return "+Inf";
  if (v === -Infinity) return "-Inf";
  return String(v);
}

export function renderPrometheus(metrics: PromMetric[]): string {
  const lines: string[] = [];
  for (const m of metrics) {
    lines.push(`# HELP ${m.name} ${escapeHelp(m.help)}`);
    lines.push(`# TYPE ${m.name} ${m.type}`);
    for (const s of m.samples) {
      lines.push(`${m.name}${formatLabels(s.labels)} ${formatValue(s.value)}`);
    }
  }
  // The exposition format requires a trailing newline.
  return lines.join("\n") + "\n";
}

function count(db: Database.Database, sql: string): number {
  return (db.prepare(sql).get() as { n: number }).n;
}

export function collectMetrics(db: Database.Database): PromMetric[] {
  const statusRows = db.prepare(`SELECT status, COUNT(*) AS n FROM sessions GROUP BY status`).all() as {
    status: string;
    n: number;
  }[];
  const byStatus: Record<string, number> = { active: 0, waiting: 0, ended: 0 };
  for (const r of statusRows) byStatus[r.status] = r.n;

  const tokens = db
    .prepare(
      `SELECT COALESCE(SUM(token_input),0) AS input, COALESCE(SUM(token_output),0) AS output, COALESCE(SUM(token_cache),0) AS cache FROM sessions`,
    )
    .get() as { input: number; output: number; cache: number };

  const costUsd = (db.prepare(`SELECT COALESCE(SUM(cost_usd),0) AS n FROM sessions`).get() as { n: number }).n;

  return [
    { name: "mc_up", help: "1 if the dashboard is serving metrics.", type: "gauge", samples: [{ value: 1 }] },
    {
      name: "mc_build_info",
      help: "Build metadata; value is always 1.",
      type: "gauge",
      samples: [{ value: 1, labels: { version: process.env.npm_package_version ?? "unknown" } }],
    },
    {
      name: "mc_sessions",
      help: "Sessions by current status.",
      type: "gauge",
      samples: Object.entries(byStatus).map(([status, value]) => ({ value, labels: { status } })),
    },
    {
      name: "mc_events_total",
      help: "Total events ingested from hooks.",
      type: "counter",
      samples: [{ value: count(db, `SELECT COUNT(*) AS n FROM events`) }],
    },
    {
      name: "mc_tool_calls_total",
      help: "Total tool calls recorded.",
      type: "counter",
      samples: [{ value: count(db, `SELECT COUNT(*) AS n FROM tool_calls`) }],
    },
    {
      name: "mc_tool_call_errors_total",
      help: "Tool calls that reported failure.",
      type: "counter",
      samples: [{ value: count(db, `SELECT COUNT(*) AS n FROM tool_calls WHERE success = 0`) }],
    },
    { name: "mc_cost_usd", help: "Estimated cost across all sessions, USD.", type: "gauge", samples: [{ value: costUsd }] },
    {
      name: "mc_tokens",
      help: "Token totals across all sessions, by type.",
      type: "gauge",
      samples: [
        { value: tokens.input, labels: { type: "input" } },
        { value: tokens.output, labels: { type: "output" } },
        { value: tokens.cache, labels: { type: "cache" } },
      ],
    },
    {
      name: "mc_alerts_unread",
      help: "Unread in-app alerts.",
      type: "gauge",
      samples: [{ value: count(db, `SELECT COUNT(*) AS n FROM alerts WHERE read = 0`) }],
    },
    {
      name: "mc_otlp_metric_rows_total",
      help: "Metric data points received via the optional OTLP receiver.",
      type: "counter",
      samples: [{ value: count(db, `SELECT COUNT(*) AS n FROM otlp_metric`) }],
    },
    {
      name: "mc_otlp_log_rows_total",
      help: "Log records received via the optional OTLP receiver.",
      type: "counter",
      samples: [{ value: count(db, `SELECT COUNT(*) AS n FROM otlp_log`) }],
    },
  ];
}
