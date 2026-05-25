"use client";

import { useEffect, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ShieldAlert } from "lucide-react";
import { Panel } from "@/components/panel";
import { WidgetState } from "@/components/widget-state";
import { useLive } from "@/components/live-provider";
import { useView, ViewSwitch } from "@/components/view-variant";
import { useTimeRange } from "@/components/time-range";
import { useT } from "@/lib/i18n";
import type { ViewOption } from "@/plugins/registry";

// Phase F (F8): chart (default, today's look) ↔ table (per-period series rows).
const WIDGET_ID = "error-rate";
const VIEW_VALUES = ["chart", "table"] as const;
export const ERROR_RATE_VIEWS: ViewOption[] = [
  { value: "chart", label: "view.chart" },
  { value: "table", label: "view.table" },
];

interface ErrorPoint {
  date: string;
  total: number;
  failures: number;
}
interface FailingTool {
  tool: string;
  failures: number;
  total: number;
  rate: number;
}
interface Response {
  stats: { toolCalls: number; failures: number; errorRate: number };
  series: ErrorPoint[];
  topTools: FailingTool[];
}

function tone(rate: number): string {
  if (rate >= 0.2) return "text-red-400";
  if (rate >= 0.05) return "text-amber-400";
  return "text-emerald-400";
}

// Table view: the per-period series as rows (date · calls · failures · rate).
function SeriesTable({ series, t }: { series: ErrorPoint[]; t: (key: string) => string }) {
  return (
    <div className="max-h-28 w-full overflow-auto">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-panel/95 text-muted backdrop-blur">
          <tr>
            <th className="px-2 py-1 text-left font-medium">{t("tokens.colDate")}</th>
            <th className="px-2 py-1 text-right font-medium">{t("tools.colCount")}</th>
            <th className="px-2 py-1 text-right font-medium">{t("errors.failures")}</th>
            <th className="px-2 py-1 text-right font-medium">{t("errors.rate")}</th>
          </tr>
        </thead>
        <tbody>
          {series.map((p) => {
            const rate = p.total > 0 ? p.failures / p.total : 0;
            return (
              <tr key={p.date} className="border-t border-panel-border/50">
                <td className="px-2 py-1 font-mono text-foreground">{p.date.slice(5)}</td>
                <td className="px-2 py-1 text-right tabular-nums text-muted">{p.total}</td>
                <td className={`px-2 py-1 text-right tabular-nums ${p.failures > 0 ? "text-red-400" : "text-muted"}`}>
                  {p.failures}
                </td>
                <td className={`px-2 py-1 text-right tabular-nums ${tone(rate)}`}>{Math.round(rate * 100)}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const tooltipStyle = {
  background: "#0e1219",
  border: "1px solid #1c2230",
  borderRadius: 8,
  fontSize: 12,
} as const;

export function ErrorRate() {
  const { t } = useT();
  const { tick } = useLive();
  const { days } = useTimeRange();
  const view = useView(WIDGET_ID, VIEW_VALUES, "chart");
  const [data, setData] = useState<Response | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch(`/api/errors?days=${days}`)
        .then((r) => r.json())
        .then((d: Response) => {
          if (!cancelled) setData(d);
        })
        .catch(() => {});
    load();
    const poll = setInterval(load, 20_000);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, [days, tick]);

  const chart = (data?.series ?? []).map((p) => ({ date: p.date.slice(5), failures: p.failures }));

  return (
    <Panel
      title={t("errors.title")}
      icon={<ShieldAlert className="h-4 w-4 text-accent" />}
      info={t("errors.info")}
      right={<ViewSwitch widgetId={WIDGET_ID} options={ERROR_RATE_VIEWS} value={view} t={t} />}
    >
      {!data ? (
        <WidgetState icon={ShieldAlert} title={t("common.loading")} loading />
      ) : data.stats.toolCalls === 0 ? (
        <WidgetState icon={ShieldAlert} title={t("errors.empty")} />
      ) : (
        <div className="flex h-full flex-col gap-2 p-3">
          <div className="flex items-baseline gap-3">
            <span className={`font-mono text-3xl font-semibold tabular-nums ${tone(data.stats.errorRate)}`}>
              {Math.round(data.stats.errorRate * 100)}%
            </span>
            <span className="text-xs text-muted">
              {data.stats.failures} / {data.stats.toolCalls} {t("errors.failures")}
            </span>
          </div>

          {view === "table" ? (
            <SeriesTable series={data.series} t={t} />
          ) : (
            <div className="h-20 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chart} margin={{ top: 4, right: 6, bottom: 0, left: -12 }}>
                  <defs>
                    <linearGradient id="gErr" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f87171" stopOpacity={0.7} />
                      <stop offset="100%" stopColor="#f87171" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" stroke="#8b94a7" fontSize={10} tickLine={false} minTickGap={20} />
                  <YAxis stroke="#8b94a7" fontSize={10} tickLine={false} allowDecimals={false} width={28} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(value) => [String(value), t("errors.failures")]} />
                  <Area type="monotone" dataKey="failures" stroke="#f87171" fill="url(#gErr)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-auto">
            <p className="mb-1 text-[11px] font-semibold text-muted">{t("errors.topTools")}</p>
            {data.topTools.length === 0 ? (
              <p className="text-xs text-emerald-400">{t("errors.none")}</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {data.topTools.map((tl) => (
                  <li key={tl.tool} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate text-foreground">{tl.tool}</span>
                    <span className="shrink-0 tabular-nums text-muted">
                      <span className="text-red-400">{tl.failures}</span> ·{" "}
                      {Math.round(tl.rate * 100)}%
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Panel>
  );
}
