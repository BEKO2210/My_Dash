"use client";

import { useState } from "react";
import { BarChart, Bar, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Timer } from "lucide-react";
import { Panel } from "@/components/panel";
import { WidgetState } from "@/components/widget-state";
import { usePluginQuery } from "@/components/plugin-data";
import { viewState } from "@/components/widget-view";
import { useView, ViewSwitch } from "@/components/view-variant";
import type { ViewOption } from "@/plugins/registry";
import { useT } from "@/lib/i18n";
import { formatMs, type LatencyStats } from "@/lib/latency";

interface Response {
  stats: LatencyStats;
  tools: string[];
}

// Phase F (F7): histogram (default, today's look) ↔ table (per-bucket rows).
const WIDGET_ID = "latency";
const VIEW_VALUES = ["histogram", "table"] as const;
type LatencyView = (typeof VIEW_VALUES)[number];
export const LATENCY_VIEWS: ViewOption[] = [
  { value: "histogram", label: "view.histogram" },
  { value: "table", label: "view.table" },
];

const tooltipStyle = {
  background: "#0e1219",
  border: "1px solid #1c2230",
  borderRadius: 8,
  fontSize: 12,
} as const;

export function Latency() {
  const { t } = useT();
  const [tool, setTool] = useState("");
  const view = useView(WIDGET_ID, VIEW_VALUES, "histogram");
  const q = usePluginQuery<Response>(
    `/api/tools/latency${tool ? `?tool=${encodeURIComponent(tool)}` : ""}`,
    { pollMs: 30_000 },
  );
  const vs = viewState(q, (d) => d.stats.count === 0);

  return (
    <Panel
      title={t("latency.title")}
      icon={<Timer className="h-4 w-4 text-accent" />}
      info={t("latency.info")}
      right={
        <div className="flex items-center gap-1.5">
          <select
            value={tool}
            onChange={(e) => setTool(e.target.value)}
            aria-label={t("latency.tool")}
            className="max-w-[10rem] rounded-md border border-panel-border bg-background px-2 py-1 text-xs text-foreground outline-none focus:border-accent"
          >
            <option value="">{t("latency.all")}</option>
            {(q.data?.tools ?? []).map((tn) => (
              <option key={tn} value={tn}>
                {tn}
              </option>
            ))}
          </select>
          <ViewSwitch widgetId={WIDGET_ID} options={LATENCY_VIEWS} value={view} t={t} />
        </div>
      }
    >
      {vs === "error" ? (
        <WidgetState icon={Timer} title={t("common.loadError")} onRetry={q.refetch} retryLabel={t("common.retry")} />
      ) : vs === "loading" ? (
        <WidgetState icon={Timer} title={t("common.loading")} loading />
      ) : vs === "empty" ? (
        <WidgetState icon={Timer} title={t("latency.empty")} />
      ) : (
        <LatencyBody stats={q.data!.stats} view={view} t={t} />
      )}
    </Panel>
  );
}

function LatencyBody({ stats, view, t }: { stats: LatencyStats; view: LatencyView; t: (key: string) => string }) {
  return (
    <div className="flex h-full flex-col gap-2 p-3">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <Stat label="p50" value={formatMs(stats.p50)} tone="text-emerald-400" />
        <Stat label="p95" value={formatMs(stats.p95)} tone="text-amber-400" />
        <Stat label="p99" value={formatMs(stats.p99)} tone="text-red-400" />
        <Stat label={t("latency.max")} value={formatMs(stats.max)} tone="text-muted" />
        <Stat label="n" value={String(stats.count)} tone="text-muted" />
      </div>
      {view === "table" ? (
        <BucketTable buckets={stats.buckets} t={t} />
      ) : (
        <div className="min-h-0 flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.buckets} margin={{ top: 6, right: 8, bottom: 0, left: -8 }}>
              <CartesianGrid stroke="#1c2230" vertical={false} />
              <XAxis dataKey="label" stroke="#8b94a7" fontSize={10} tickLine={false} interval={0} angle={-30} textAnchor="end" height={42} />
              <YAxis stroke="#8b94a7" fontSize={11} tickLine={false} allowDecimals={false} width={36} />
              <Tooltip
                contentStyle={tooltipStyle}
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
                formatter={(value) => [String(value), t("latency.calls")]}
              />
              <Bar dataKey="count" fill="#4f8cff" radius={[3, 3, 0, 0]} isAnimationActive />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// Table view: the histogram's buckets as rows (range · in-bar · calls).
function BucketTable({ buckets, t }: { buckets: LatencyStats["buckets"]; t: (key: string) => string }) {
  const max = Math.max(1, ...buckets.map((b) => b.count));
  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-panel/95 text-muted backdrop-blur">
          <tr>
            <th className="px-2 py-1.5 text-left font-medium">{t("latency.bucket")}</th>
            <th className="px-2 py-1.5 text-right font-medium">{t("latency.calls")}</th>
          </tr>
        </thead>
        <tbody>
          {buckets.map((b) => (
            <tr key={b.label} className="border-t border-panel-border/50">
              <td className="px-2 py-1 text-foreground">
                <div className="flex items-center gap-2">
                  <span className="relative h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-background/70">
                    <span
                      className="absolute inset-y-0 left-0 rounded-full bg-accent/70"
                      style={{ width: `${Math.max(2, (b.count / max) * 100)}%` }}
                    />
                  </span>
                  <span className="font-mono">{b.label}</span>
                </div>
              </td>
              <td className="px-2 py-1 text-right tabular-nums text-muted">{b.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <span className="flex items-baseline gap-1">
      <span className="text-muted">{label}</span>
      <span className={`font-mono font-semibold tabular-nums ${tone}`}>{value}</span>
    </span>
  );
}
