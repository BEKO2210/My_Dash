"use client";

import { useEffect, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { PieChart as PieIcon } from "lucide-react";
import { Panel } from "@/components/panel";
import { WidgetState } from "@/components/widget-state";
import { useT } from "@/lib/i18n";
import { formatCompact, formatMoney } from "@/lib/format";
import { modelShare, OTHER, type ModelSlice } from "@/lib/model-usage";
import type { UsageReport } from "@/lib/ccusage";

type Mode = "cost" | "tokens";

// Wong color-blind-safe palette; "Other" is neutral grey.
const PALETTE = ["#0072B2", "#E69F00", "#009E73", "#CC79A7", "#56B4E9", "#D55E00"];
const OTHER_COLOR = "#6b7280";

const colorFor = (s: ModelSlice, i: number) => (s.full === OTHER ? OTHER_COLOR : PALETTE[i % PALETTE.length]);

export function ModelDonut() {
  const { t } = useT();
  const [usage, setUsage] = useState<UsageReport | null>(null);
  const [mode, setMode] = useState<Mode>("cost");

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch("/api/usage")
        .then((r) => r.json())
        .then((d: UsageReport) => {
          if (!cancelled) setUsage(d);
        })
        .catch(() => {});
    load();
    const poll = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, []);

  const { slices, total } = modelShare(usage?.models ?? [], mode);
  const fmt = (n: number) => (mode === "cost" ? formatMoney(n, "EUR") : formatCompact(n));
  const label = (s: ModelSlice) => (s.full === OTHER ? t("donut.other") : s.name);

  return (
    <Panel
      title={t("donut.title")}
      icon={<PieIcon className="h-4 w-4 text-accent" />}
      info={t("donut.info")}
      right={
        <div className="flex rounded-md border border-panel-border text-xs">
          {(["tokens", "cost"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-2 py-1 ${mode === m ? "bg-accent/20 text-accent" : "text-muted hover:text-foreground"}`}
            >
              {m === "tokens" ? t("tokens.modeTokens") : t("tokens.modeCost")}
            </button>
          ))}
        </div>
      }
    >
      {!usage ? (
        <WidgetState icon={PieIcon} title={t("common.loading")} loading />
      ) : slices.length === 0 ? (
        <WidgetState icon={PieIcon} title={t("donut.empty")} />
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
