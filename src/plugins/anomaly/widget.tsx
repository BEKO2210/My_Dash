"use client";

import { Activity, TrendingDown, TrendingUp } from "lucide-react";
import { Panel } from "@/components/panel";
import { WidgetState } from "@/components/widget-state";
import { usePluginQuery } from "@/components/plugin-data";
import { useT } from "@/lib/i18n";
import { formatMs } from "@/lib/latency";
import type { AnomalyReport, MetricComparison } from "@/lib/anomaly";

function Row({
  label,
  cmp,
  format,
  t,
}: {
  label: string;
  cmp: MetricComparison;
  format: (n: number) => string;
  t: (k: string) => string;
}) {
  const pct = Math.round(cmp.deltaPct * 100);
  const up = cmp.deltaPct > 0.005;
  const down = cmp.deltaPct < -0.005;
  const Icon = up ? TrendingUp : down ? TrendingDown : Activity;
  const tone = cmp.anomalous ? "text-red-400" : up ? "text-amber-400" : "text-emerald-400";
  return (
    <div className="rounded-lg bg-white/[0.03] p-3">
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-muted">{label}</span>
        <span className={`flex items-center gap-1 text-xs tabular-nums ${tone}`}>
          <Icon className="h-3 w-3" />
          {pct > 0 ? "+" : ""}
          {pct}%
        </span>
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="font-mono text-lg tabular-nums text-foreground">{format(cmp.recent)}</span>
        <span className="text-[11px] text-muted">
          {t("anomaly.vs")} {format(cmp.baseline)}
        </span>
      </div>
      {cmp.anomalous && <p className="mt-1 text-[11px] text-red-400">{t("anomaly.flag")}</p>}
    </div>
  );
}

export function Anomaly() {
  const { t } = useT();
  const { data } = usePluginQuery<AnomalyReport>("/api/anomaly", { pollMs: 30_000 });

  return (
    <Panel title={t("anomaly.title")} icon={<Activity className="h-4 w-4 text-accent" />} info={t("anomaly.info")}>
      {!data ? (
        <WidgetState icon={Activity} title={t("common.loading")} loading />
      ) : data.recentSamples === 0 && data.baselineSamples === 0 ? (
        <WidgetState icon={Activity} title={t("anomaly.empty")} />
      ) : (
        <div className="flex h-full flex-col justify-center gap-3 p-4">
          <Row label={t("anomaly.latency")} cmp={data.latencyMs} format={(n) => formatMs(Math.round(n))} t={t} />
          <Row label={t("anomaly.errorRate")} cmp={data.errorRate} format={(n) => `${Math.round(n * 100)}%`} t={t} />
          <p className="text-center text-[10px] text-muted/70">
            {t("anomaly.window")} · n={data.recentSamples}/{data.baselineSamples}
          </p>
        </div>
      )}
    </Panel>
  );
}
