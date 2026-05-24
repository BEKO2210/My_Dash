"use client";

import { useEffect, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import { Gauge, TrendingDown, TrendingUp } from "lucide-react";
import { Panel } from "@/components/panel";
import { WidgetState } from "@/components/widget-state";
import { useLive } from "@/components/live-provider";
import { useTimeRange } from "@/components/time-range";
import { useT } from "@/lib/i18n";
import {
  eventsPerSession,
  movingAverage,
  toolsPerMinute,
  trendDelta,
  type VelocityDay,
} from "@/lib/velocity";

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
  const { tick } = useLive();
  const { t } = useT();
  const { days: rangeDays } = useTimeRange();
  const [days, setDays] = useState<VelocityDay[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch(`/api/velocity?days=${rangeDays}`)
        .then((r) => r.json())
        .then((d: { days: VelocityDay[] }) => {
          if (!cancelled) setDays(d.days);
        })
        .catch(() => {});
    load();
    const poll = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, [rangeDays, tick]);

  const empty = days && days.every((d) => d.toolCalls === 0 && d.events === 0);

  const tpm = (days ?? []).map(toolsPerMinute);
  const eps = (days ?? []).map(eventsPerSession);
  const tpmAvg = movingAverage(tpm, 7);
  const epsAvg = movingAverage(eps, 7);
  const chartTpm = (days ?? []).map((d, i) => ({ date: d.date, v: +tpm[i].toFixed(3), avg: +tpmAvg[i].toFixed(3) }));
  const chartEps = (days ?? []).map((d, i) => ({ date: d.date, v: +eps[i].toFixed(2), avg: +epsAvg[i].toFixed(2) }));

  return (
    <Panel title={t("velocity.title")} icon={<Gauge className="h-4 w-4 text-accent" />} info={t("velocity.info")}>
      {!days ? (
        <WidgetState icon={Gauge} title={t("common.loading")} loading />
      ) : empty ? (
        <WidgetState icon={Gauge} title={t("velocity.empty")} />
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
