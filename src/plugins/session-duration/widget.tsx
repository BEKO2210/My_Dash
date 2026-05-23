"use client";

import { useEffect, useState } from "react";
import { BarChart, Bar, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Hourglass } from "lucide-react";
import { Panel } from "@/components/panel";
import { WidgetState } from "@/components/widget-state";
import { useLive } from "@/components/live-provider";
import { useT } from "@/lib/i18n";
import { formatDuration } from "@/lib/format";
import type { DurationStats } from "@/lib/session-duration";

const tooltipStyle = {
  background: "#0e1219",
  border: "1px solid #1c2230",
  borderRadius: 8,
  fontSize: 12,
} as const;

export function SessionDuration() {
  const { t } = useT();
  const { tick } = useLive();
  const [stats, setStats] = useState<DurationStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch("/api/session-duration")
        .then((r) => r.json())
        .then((d: DurationStats) => {
          if (!cancelled) setStats(d);
        })
        .catch(() => {});
    load();
    const poll = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, [tick]);

  return (
    <Panel title={t("sessionDur.title")} icon={<Hourglass className="h-4 w-4 text-accent" />} info={t("sessionDur.info")}>
      {!stats ? (
        <WidgetState icon={Hourglass} title={t("common.loading")} loading />
      ) : stats.count === 0 ? (
        <WidgetState icon={Hourglass} title={t("sessionDur.empty")} />
      ) : (
        <div className="flex h-full flex-col gap-2 p-3">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <Stat label={t("sessionDur.median")} value={formatDuration(stats.median)} tone="text-emerald-400" />
            <Stat label="p95" value={formatDuration(stats.p95)} tone="text-amber-400" />
            <Stat label={t("sessionDur.max")} value={formatDuration(stats.max)} tone="text-muted" />
            <Stat label="n" value={String(stats.count)} tone="text-muted" />
          </div>
          <div className="min-h-0 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.buckets} margin={{ top: 6, right: 8, bottom: 0, left: -8 }}>
                <CartesianGrid stroke="#1c2230" vertical={false} />
                <XAxis dataKey="label" stroke="#8b94a7" fontSize={10} tickLine={false} interval={0} angle={-30} textAnchor="end" height={42} />
                <YAxis stroke="#8b94a7" fontSize={11} tickLine={false} allowDecimals={false} width={36} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                <Bar dataKey="count" fill="#4f8cff" radius={[3, 3, 0, 0]} isAnimationActive />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </Panel>
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
