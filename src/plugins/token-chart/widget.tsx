"use client";

import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Coins } from "lucide-react";
import { Panel } from "@/components/panel";
import { WidgetState } from "@/components/widget-state";
import { usePluginQuery } from "@/components/plugin-data";
import { viewState } from "@/components/widget-view";
import { useView, ViewSwitch } from "@/components/view-variant";
import type { ViewOption } from "@/plugins/registry";
import { useT, type Lang } from "@/lib/i18n";
import type { UsageReport } from "@/lib/ccusage";
import { formatCompact, formatCurrency } from "@/lib/format";
import { useCurrency, type Currency } from "@/components/currency";

type Mode = "tokens" | "cost";
type Range = "24h" | "daily" | "monthly";

const RANGE_LABELS: Record<Range, string> = {
  "24h": "tokens.range24h",
  daily: "tokens.rangeDaily",
  monthly: "tokens.rangeMonthly",
};

// Phase F (F1): chart (default, today's look) ↔ table (per-period numeric rows).
const WIDGET_ID = "token-chart";
const VIEW_VALUES = ["chart", "table"] as const;
export const TOKEN_CHART_VIEWS: ViewOption[] = [
  { value: "chart", label: "view.chart" },
  { value: "table", label: "view.table" },
];

interface Row {
  date: string;
  input: number;
  output: number;
  cache: number;
  costEur: number;
  costUsd: number;
}

const hhmm = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

export function TokenChart() {
  const { t, lang } = useT();
  const [mode, setMode] = useState<Mode>("tokens");
  const [range, setRange] = useState<Range>("daily");
  const { currency, setCurrency } = useCurrency();
  const view = useView(WIDGET_ID, VIEW_VALUES, "chart");
  const q = usePluginQuery<UsageReport>("/api/usage", { pollMs: 30_000 });
  const usage = q.data;

  const data =
    range === "24h"
      ? (usage?.blocks ?? []).map((b) => ({
          date: hhmm(b.start),
          input: b.inputTokens,
          output: b.outputTokens,
          cache: b.cacheTokens,
          costEur: Number(b.costEur.toFixed(2)),
          costUsd: Number(b.costUsd.toFixed(2)),
        }))
      : (range === "monthly" ? (usage?.months ?? []) : (usage?.days ?? [])).map((d) => ({
          date: range === "monthly" ? d.date : d.date.slice(5), // YYYY-MM vs MM-DD
          input: d.inputTokens,
          output: d.outputTokens,
          cache: d.cacheTokens,
          costEur: Number(d.costEur.toFixed(2)),
          costUsd: Number(d.costUsd.toFixed(2)),
        }));

  const costKey = currency === "EUR" ? "costEur" : "costUsd";
  // Totals reflect the selected range + currency.
  const shownCost = data.reduce((a, d) => a + d[costKey], 0);
  const shownTokens = data.reduce((a, d) => a + d.input + d.output + d.cache, 0);
  const vs = viewState(q, (d) => !d.available || data.length === 0);

  return (
    <Panel
      title={t("tokens.title")}
      icon={<Coins className="h-4 w-4 text-accent" />}
      info={t("tokens.info")}
      right={
        <div className="flex items-center gap-2">
          <span className="hidden text-xs text-muted lg:inline">
            {formatCurrency(shownCost, currency, lang)} · {formatCompact(shownTokens)} {t("tokens.tok")}
          </span>
          <div className="flex rounded-md border border-panel-border text-xs">
            {(["24h", "daily", "monthly"] as Range[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                aria-pressed={range === r}
                className={`px-2 py-1 ${range === r ? "bg-accent/20 text-accent" : "text-muted hover:text-foreground"}`}
              >
                {t(RANGE_LABELS[r])}
              </button>
            ))}
          </div>
          {view === "chart" && (
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
          )}
          {((view === "chart" && mode === "cost") || view === "table") && (
            <div className="flex rounded-md border border-panel-border text-xs">
              {(["EUR", "USD"] as Currency[]).map((c) => (
                <button
                  key={c}
                  onClick={() => setCurrency(c)}
                  aria-pressed={currency === c}
                  className={`px-2 py-1 ${currency === c ? "bg-accent/20 text-accent" : "text-muted hover:text-foreground"}`}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
          <ViewSwitch widgetId={WIDGET_ID} options={TOKEN_CHART_VIEWS} value={view} t={t} />
        </div>
      }
    >
      {vs === "error" ? (
        <WidgetState icon={Coins} title={t("common.loadError")} onRetry={q.refetch} retryLabel={t("common.retry")} />
      ) : vs === "loading" ? (
        <WidgetState icon={Coins} title={t("common.loading")} loading />
      ) : vs === "empty" ? (
        <WidgetState icon={Coins} title={emptyMessage(t, usage?.available ?? false, range)} />
      ) : view === "table" ? (
        <TokenTable rows={data} currency={currency} lang={lang} t={t} />
      ) : (
        <div className="h-full w-full p-2">
          <ResponsiveContainer width="100%" height="100%">
            {mode === "tokens" ? (
              <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
                <defs>
                  <linearGradient id="gIn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.7} />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gOut" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" stopOpacity={0.7} />
                    <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gCache" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#1c2230" vertical={false} />
                <XAxis dataKey="date" stroke="#8b94a7" fontSize={11} tickLine={false} />
                <YAxis
                  stroke="#8b94a7"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(v) => formatCompact(v as number)}
                  width={56}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value, name) => [formatCompact(Number(value)), t(`tokens.${String(name)}`)]}
                />
                <Legend
                  iconType="circle"
                  wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
                  formatter={(value) => <span className="text-muted">{t(`tokens.${String(value)}`)}</span>}
                />
                <Area type="monotone" dataKey="cache" stackId="1" stroke="#a78bfa" fill="url(#gCache)" />
                <Area type="monotone" dataKey="input" stackId="1" stroke="#38bdf8" fill="url(#gIn)" />
                <Area type="monotone" dataKey="output" stackId="1" stroke="#34d399" fill="url(#gOut)" />
              </AreaChart>
            ) : (
              <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
                <CartesianGrid stroke="#1c2230" vertical={false} />
                <XAxis dataKey="date" stroke="#8b94a7" fontSize={11} tickLine={false} />
                <YAxis
                  stroke="#8b94a7"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(v) => (currency === "EUR" ? "€" : "$") + v}
                  width={56}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value) => [formatCurrency(Number(value), currency, lang), t("tokens.cost")]}
                />
                <Bar dataKey={costKey} fill="#4f8cff" radius={[4, 4, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}

const tooltipStyle = {
  background: "#0e1219",
  border: "1px solid #1c2230",
  borderRadius: 8,
  fontSize: 12,
} as const;

function emptyMessage(t: (key: string) => string, available: boolean, range: Range): string {
  if (!available) return t("tokens.emptyUnavailable");
  return range === "24h" ? t("tokens.empty24h") : t("tokens.emptyNone");
}

// Table view: the same per-period data as the chart, as precise numeric rows.
function TokenTable({
  rows,
  currency,
  lang,
  t,
}: {
  rows: Row[];
  currency: Currency;
  lang: Lang;
  t: (key: string) => string;
}) {
  const costKey = currency === "EUR" ? "costEur" : "costUsd";
  return (
    <div tabIndex={0} className="h-full overflow-auto outline-none">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-panel/95 text-muted backdrop-blur">
          <tr>
            <th className="px-3 py-2 text-left font-medium">{t("tokens.colDate")}</th>
            <th className="px-2 py-2 text-right font-medium">{t("tokens.input")}</th>
            <th className="px-2 py-2 text-right font-medium">{t("tokens.output")}</th>
            <th className="px-2 py-2 text-right font-medium">{t("tokens.cache")}</th>
            <th className="px-3 py-2 text-right font-medium">{t("tokens.cost")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.date} className="border-t border-panel-border/50 transition-colors hover:bg-white/[0.03]">
              <td className="whitespace-nowrap px-3 py-1.5 font-mono text-foreground">{r.date}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-sky-400">{formatCompact(r.input)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-emerald-400">{formatCompact(r.output)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-violet-400">{formatCompact(r.cache)}</td>
              <td className="px-3 py-1.5 text-right tabular-nums text-foreground">{formatCurrency(r[costKey], currency, lang)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
