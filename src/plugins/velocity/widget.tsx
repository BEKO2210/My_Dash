"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import { Gauge, TrendingDown, TrendingUp } from "lucide-react";
import { Panel } from "@/components/panel";
import { WidgetState } from "@/components/widget-state";
import { usePluginQuery } from "@/components/plugin-data";
import { viewState } from "@/components/widget-view";
import { useView, ViewSwitch } from "@/components/view-variant";
import type { ViewOption } from "@/plugins/registry";
import { useTimeRange } from "@/components/time-range";
import { useT } from "@/lib/i18n";
import {
  eventsPerSession,
  movingAverage,
  toolsPerMinute,
  trendDelta,
  type VelocityDay,
} from "@/lib/velocity";

// Phase F (F12): sparklines (default, today's look) ↔ table (per-day rows).
const WIDGET_ID = "velocity";
const VIEW_VALUES = ["sparklines", "table"] as const;
export const VELOCITY_VIEWS: ViewOption[] = [
  { value: "sparklines", label: "view.sparklines" },
  { value: "table", label: "view.table" },
];

const TOOLTIP = {
  contentStyle: { background: "#0e1219", border: "1px solid #1c2230", borderRadius: 8, fontSize: 12 },
  labelStyle: { color: "#8b94a7" },
};

function Delta({ value }: { value: number }) {
  if (Math.abs(value) < 0.005) return <span className="text-[11px] text-muted">±0%</span>;
  const up = value > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={`flex items-center gap-0.5 text-[11px] tabular-nums ${up ? "text-emerald-400" : "text-amber-400"}`}>
      <Icon className="h-3 w-3" />
      {up ? "+" : ""}
      {(value * 100).toFixed(0)}%
    </span>
  );
}

function Trend({
  label,
  data,
  delta,
  format,
}: {
  label: string;
  data: { date: string; v: number; avg: number }[];
  delta: number;
  format: (n: number) => string;
}) {
  const { t } = useT();
  return (
    <div className="min-h-0 flex-1">
      <div className="mb-0.5 flex items-baseline justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</span>
        <Delta value={delta} />
      </div>
      <div className="h-[72px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <YAxis hide domain={[0, "dataMax"]} />
            <Tooltip
              {...TOOLTIP}
              formatter={(val, name) => [format(Number(val)), name === "avg" ? t("velocity.avg") : t("velocity.day")]}
            />
            <Line type="monotone" dataKey="v" stroke="#475569" strokeWidth={1} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="avg" stroke="#4f8cff" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function Velocity() {
  const { t } = useT();
  const { days: rangeDays } = useTimeRange();
  const view = useView(WIDGET_ID, VIEW_VALUES, "sparklines");
  const q = usePluginQuery<{ days: VelocityDay[] }>(`/api/velocity?days=${rangeDays}`, { pollMs: 30_000 });

  const days = q.data?.days ?? [];
  const vs = viewState(q, () => days.length === 0 || days.every((d) => d.toolCalls === 0 && d.events === 0));

  const tpm = days.map(toolsPerMinute);
  const eps = days.map(eventsPerSession);
  const tpmAvg = movingAverage(tpm, 7);
  const epsAvg = movingAverage(eps, 7);
  const chartTpm = days.map((d, i) => ({ date: d.date, v: +tpm[i].toFixed(3), avg: +tpmAvg[i].toFixed(3) }));
  const chartEps = days.map((d, i) => ({ date: d.date, v: +eps[i].toFixed(2), avg: +epsAvg[i].toFixed(2) }));

  return (
    <Panel
      title={t("velocity.title")}
      icon={<Gauge className="h-4 w-4 text-accent" />}
      info={t("velocity.info")}
      right={<ViewSwitch widgetId={WIDGET_ID} options={VELOCITY_VIEWS} value={view} t={t} />}
    >
      {vs === "error" ? (
        <WidgetState icon={Gauge} title={t("common.loadError")} onRetry={q.refetch} retryLabel={t("common.retry")} />
      ) : vs === "loading" ? (
        <WidgetState icon={Gauge} title={t("common.loading")} loading />
      ) : vs === "empty" ? (
        <WidgetState icon={Gauge} title={t("velocity.empty")} />
      ) : view === "table" ? (
        <VelocityTable days={days} tpm={tpm} eps={eps} t={t} />
      ) : (
        <div className="flex h-full flex-col gap-3 p-4">
          <Trend
            label={t("velocity.toolsPerMin")}
            data={chartTpm}
            delta={trendDelta(tpm, 7)}
            format={(n) => n.toFixed(2)}
          />
          <Trend
            label={t("velocity.eventsPerSession")}
            data={chartEps}
            delta={trendDelta(eps, 7)}
            format={(n) => n.toFixed(1)}
          />
        </div>
      )}
    </Panel>
  );
}

// Table view: the same per-day metrics as the sparklines (date · tools/min ·
// events/session), most-recent first.
function VelocityTable({
  days,
  tpm,
  eps,
  t,
}: {
  days: VelocityDay[];
  tpm: number[];
  eps: number[];
  t: (key: string) => string;
}) {
  const rows = days.map((d, i) => ({ date: d.date, tpm: tpm[i], eps: eps[i] })).reverse();
  return (
    <div tabIndex={0} className="h-full overflow-auto outline-none">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-panel/95 text-muted backdrop-blur">
          <tr>
            <th className="px-3 py-2 text-left font-medium">{t("tokens.colDate")}</th>
            <th className="px-2 py-2 text-right font-medium">{t("velocity.toolsPerMin")}</th>
            <th className="px-3 py-2 text-right font-medium">{t("velocity.eventsPerSession")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.date} className="border-t border-panel-border/50 transition-colors hover:bg-white/[0.03]">
              <td className="px-3 py-1.5 font-mono text-foreground">{r.date.slice(5)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-foreground">{r.tpm.toFixed(2)}</td>
              <td className="px-3 py-1.5 text-right tabular-nums text-foreground">{r.eps.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
