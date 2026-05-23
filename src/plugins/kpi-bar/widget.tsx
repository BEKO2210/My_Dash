"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import { Activity, AlertTriangle, Coins, Hammer, Radio } from "lucide-react";
import { useLive } from "@/components/live-provider";
import { useT } from "@/lib/i18n";
import { formatCompact, formatMoney } from "@/lib/format";
import { cn } from "@/lib/cn";

interface Stats {
  activeSessions: number;
  eventsToday: number;
  toolCallsToday: number;
  errorRate: number;
  sparkline: number[];
  costTodayUsd: number;
}

// Subtle count-up so a changing number reads as "it changed" (counters change
// blindness), honouring reduced-motion.
function useCountUp(value: number, ms = 600): number {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    const from = prev.current;
    prev.current = value;
    if (from === value) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const start = performance.now();
    // Only updates state inside the rAF callback (async), never synchronously in
    // the effect. Reduced motion snaps on the first frame.
    const step = (t: number) => {
      const p = reduce ? 1 : Math.min(1, (t - start) / ms);
      setDisplay(from + (value - from) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return display;
}

function Sparkline({ data, className }: { data: number[]; className?: string }) {
  if (data.length < 2) return null;
  const max = Math.max(1, ...data);
  const w = 100;
  const h = 24;
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * h}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={cn("h-5 w-full", className)} aria-hidden>
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  format,
  tone = "text-accent",
  sparkline,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: number;
  format: (n: number) => string;
  tone?: string;
  sparkline?: number[];
}) {
  const animated = useCountUp(value);
  return (
    <div className="flex min-h-[88px] flex-col justify-between rounded-xl border border-panel-border bg-panel/70 p-3 backdrop-blur">
      <div className="flex items-center gap-1.5 text-[11px] text-muted">
        <Icon className={cn("h-3.5 w-3.5", tone)} />
        <span className="truncate">{label}</span>
      </div>
      <div className={cn("font-mono text-2xl font-semibold tabular-nums tracking-tight", tone)}>
        {format(animated)}
      </div>
      {sparkline ? <Sparkline data={sparkline} className={tone} /> : <div className="h-5" />}
    </div>
  );
}

function errorTone(rate: number): string {
  if (rate >= 0.2) return "text-red-400";
  if (rate >= 0.05) return "text-amber-400";
  return "text-emerald-400";
}

export function KpiBar() {
  const { t } = useT();
  const { tick } = useLive();
  const [s, setS] = useState<Stats | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch("/api/stats")
        .then((r) => r.json())
        .then((d: Stats) => {
          if (!cancelled) setS(d);
        })
        .catch(() => {});
    load();
    const poll = setInterval(load, 15_000);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, [tick]);

  const d = s ?? {
    activeSessions: 0,
    eventsToday: 0,
    toolCallsToday: 0,
    errorRate: 0,
    sparkline: [],
    costTodayUsd: 0,
  };

  return (
    <div className="grid h-full grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <Stat icon={Radio} label={t("kpi.active")} value={d.activeSessions} format={(n) => String(Math.round(n))} />
      <Stat
        icon={Activity}
        label={t("kpi.events")}
        value={d.eventsToday}
        format={(n) => formatCompact(Math.round(n))}
        sparkline={d.sparkline}
      />
      <Stat
        icon={Hammer}
        label={t("kpi.tools")}
        value={d.toolCallsToday}
        format={(n) => formatCompact(Math.round(n))}
        tone="text-sky-400"
      />
      <Stat
        icon={AlertTriangle}
        label={t("kpi.errors")}
        value={d.errorRate}
        format={(n) => `${Math.round(n * 100)}%`}
        tone={errorTone(d.errorRate)}
      />
      <Stat
        icon={Coins}
        label={t("kpi.cost")}
        value={d.costTodayUsd}
        format={(n) => formatMoney(n, "USD")}
        tone="text-emerald-400"
      />
    </div>
  );
}
