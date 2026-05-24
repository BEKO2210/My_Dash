"use client";

import { useEffect, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ShieldAlert } from "lucide-react";
import { Panel } from "@/components/panel";
import { WidgetState } from "@/components/widget-state";
import { useLive } from "@/components/live-provider";
import { useTimeRange } from "@/components/time-range";
import { useT } from "@/lib/i18n";

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
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="failures" stroke="#f87171" fill="url(#gErr)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

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
