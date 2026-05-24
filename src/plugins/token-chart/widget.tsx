"use client";

import { useEffect, useState } from "react";
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
import { useT } from "@/lib/i18n";
import type { UsageReport } from "@/lib/ccusage";
import { formatCompact, formatMoney } from "@/lib/format";

type Mode = "tokens" | "cost";
type Range = "24h" | "daily" | "monthly";
type Currency = "EUR" | "USD";
const SYMBOL: Record<Currency, string> = { EUR: "€", USD: "$" };

const RANGE_LABELS: Record<Range, string> = {
  "24h": "tokens.range24h",
  daily: "tokens.rangeDaily",
  monthly: "tokens.rangeMonthly",
};

const hhmm = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

export function TokenChart() {
  const { t } = useT();
  const [usage, setUsage] = useState<UsageReport | null>(null);
  const [mode, setMode] = useState<Mode>("tokens");
  const [range, setRange] = useState<Range>("daily");
  const [currency, setCurrency] = useState<Currency>("EUR");

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

  return (
    <Panel
      title={t("tokens.title")}
      icon={<Coins className="h-4 w-4 text-accent" />}
      info={t("tokens.info")}
      right={
        <div className="flex items-center gap-2">
          <span className="hidden text-xs text-muted lg:inline">
            {formatMoney(shownCost, currency)} · {formatCompact(shownTokens)} {t("tokens.tok")}
          </span>
          <div className="flex rounded-md border border-panel-border text-xs">
            {(["24h", "daily", "monthly"] as Range[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-2 py-1 ${range === r ? "bg-accent/20 text-accent" : "text-muted hover:text-foreground"}`}
              >
                {t(RANGE_LABELS[r])}
              </button>
            ))}
          </div>
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
          {mode === "cost" && (
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
        </div>
      }
    >
      {!usage ? (
        <WidgetState icon={Coins} title={t("common.loading")} loading />
      ) : !usage.available || data.length === 0 ? (
        <WidgetState icon={Coins} title={emptyMessage(t, usage.available, range)} />
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
                  tickFormatter={(v) => SYMBOL[currency] + v}
                  width={56}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value) => [formatMoney(Number(value), currency), t("tokens.cost")]}
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
