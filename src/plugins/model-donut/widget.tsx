"use client";

import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { PieChart as PieIcon } from "lucide-react";
import { Panel } from "@/components/panel";
import { WidgetState } from "@/components/widget-state";
import { usePluginQuery } from "@/components/plugin-data";
import { viewState } from "@/components/widget-view";
import { useView, ViewSwitch } from "@/components/view-variant";
import type { ViewOption } from "@/plugins/registry";
import { useT } from "@/lib/i18n";
import { formatCompact, formatMoney } from "@/lib/format";
import { modelShare, OTHER, type ModelSlice } from "@/lib/model-usage";
import type { UsageReport } from "@/lib/ccusage";

type Mode = "cost" | "tokens";

// Wong color-blind-safe palette; "Other" is neutral grey.
const PALETTE = ["#0072B2", "#E69F00", "#009E73", "#CC79A7", "#56B4E9", "#D55E00"];
const OTHER_COLOR = "#6b7280";

const colorFor = (s: ModelSlice, i: number) => (s.full === OTHER ? OTHER_COLOR : PALETTE[i % PALETTE.length]);

// Phase F (F2): donut (default, today's look) ↔ bars (ranked share bars).
const WIDGET_ID = "model-donut";
const VIEW_VALUES = ["donut", "bars"] as const;
export const MODEL_DONUT_VIEWS: ViewOption[] = [
  { value: "donut", label: "view.donut" },
  { value: "bars", label: "view.bars" },
];

export function ModelDonut() {
  const { t } = useT();
  const [mode, setMode] = useState<Mode>("cost");
  const view = useView(WIDGET_ID, VIEW_VALUES, "donut");
  const q = usePluginQuery<UsageReport>("/api/usage", { pollMs: 30_000 });

  const { slices, total } = modelShare(q.data?.models ?? [], mode);
  const vs = viewState(q, () => slices.length === 0);
  // modelShare uses ccusage's native USD for cost mode, so label it in USD (a € sign
  // on a USD value would misstate the amount).
  const fmt = (n: number) => (mode === "cost" ? formatMoney(n, "USD") : formatCompact(n));
  const label = (s: ModelSlice) => (s.full === OTHER ? t("donut.other") : s.name);

  return (
    <Panel
      title={t("donut.title")}
      icon={<PieIcon className="h-4 w-4 text-accent" />}
      info={t("donut.info")}
      right={
        <div className="flex items-center gap-1.5">
          <div className="flex rounded-md border border-panel-border text-xs">
            {(["tokens", "cost"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
                className={`px-2 py-1 ${mode === m ? "bg-accent/20 text-accent" : "text-muted hover:text-foreground"}`}
              >
                {m === "tokens" ? t("tokens.modeTokens") : t("tokens.modeCost")}
              </button>
            ))}
          </div>
          <ViewSwitch widgetId={WIDGET_ID} options={MODEL_DONUT_VIEWS} value={view} t={t} />
        </div>
      }
    >
      {vs === "error" ? (
        <WidgetState icon={PieIcon} title={t("common.loadError")} onRetry={q.refetch} retryLabel={t("common.retry")} />
      ) : vs === "loading" ? (
        <WidgetState icon={PieIcon} title={t("common.loading")} loading />
      ) : vs === "empty" ? (
        <WidgetState icon={PieIcon} title={t("donut.empty")} />
      ) : view === "bars" ? (
        <DonutBars slices={slices} fmt={fmt} label={label} />
      ) : (
        <div className="flex h-full items-center gap-2 p-3">
          <div className="relative h-full w-1/2 min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="62%"
                  outerRadius="88%"
                  paddingAngle={2}
                  stroke="none"
                >
                  {slices.map((s, i) => (
                    <Cell key={s.full} fill={colorFor(s, i)} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "#0e1219", border: "1px solid #1c2230", borderRadius: 8, fontSize: 12 }}
                  formatter={(value, _name, item) => {
                    const slice = ((item as { payload?: ModelSlice })?.payload ?? slices[0]) as ModelSlice;
                    return [
                      `${fmt(Number(value))} · ${Math.round((slice?.pct ?? 0) * 100)}%`,
                      label(slice),
                    ];
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-mono text-sm font-semibold tabular-nums text-foreground">{fmt(total)}</span>
              <span className="text-[10px] text-muted">{t("donut.total")}</span>
            </div>
          </div>

          <ul tabIndex={0} className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 overflow-auto text-xs outline-none">
            {slices.map((s, i) => (
              <li key={s.full} className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: colorFor(s, i) }} />
                  <span className="truncate text-foreground">{label(s)}</span>
                </span>
                <span className="shrink-0 tabular-nums text-muted">{Math.round(s.pct * 100)}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}

// Bars view: each model's share as a ranked horizontal bar (same data + colours
// as the donut + legend), with value · percent.
function DonutBars({
  slices,
  fmt,
  label,
}: {
  slices: ModelSlice[];
  fmt: (n: number) => string;
  label: (s: ModelSlice) => string;
}) {
  return (
    <ul tabIndex={0} className="flex h-full flex-col justify-center gap-2 overflow-auto p-4 outline-none">
      {slices.map((s, i) => {
        const color = colorFor(s, i);
        return (
          <li key={s.full}>
            <div className="mb-1 flex items-center justify-between gap-2 text-xs">
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: color }} />
                <span className="truncate text-foreground">{label(s)}</span>
              </span>
              <span className="shrink-0 tabular-nums text-muted">
                {fmt(s.value)} · {Math.round(s.pct * 100)}%
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-background/70">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.max(2, Math.round(s.pct * 100))}%`, backgroundColor: color }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
