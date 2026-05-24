"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import { Activity, AlertTriangle, Coins, Hammer, Radio } from "lucide-react";
import { useLive } from "@/components/live-provider";
import { useT } from "@/lib/i18n";
import { formatCompact, formatMoney } from "@/lib/format";
import { countUpValue, errorTone, sparklinePoints } from "@/lib/kpi";
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
      setDisplay(countUpValue(from, value, p));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return display;
}

function Sparkline({ data, className }: { data: number[]; className?: string }) {
  const pts = sparklinePoints(data, 100, 24);
  if (!pts) return null;
  return (
    <svg viewBox="0 0 100 24" preserveAspectRatio="none" className={cn("h-5 w-full", className)} aria-hidden>
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
  loading = false,
  unavailable = false,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: number;
  format: (n: number) => string;
  tone?: string;
  sparkline?: number[];
  loading?: boolean;
  unavailable?: boolean;
}) {
  const animated = useCountUp(value);
  return (
    <div className="flex min-h-[88px] flex-col justify-between rounded-xl border border-panel-border bg-panel/70 p-3 backdrop-blur">
      <div className="flex items-center gap-1.5 text-[11px] text-muted">
        <Icon className={cn("h-3.5 w-3.5", unavailable ? "text-muted" : tone)} />
        <span className="truncate">{label}</span>
      </div>
      <div
        className={cn(
          "font-mono text-2xl font-semibold tabular-nums tracking-tight",
          unavailable ? "text-muted" : tone,
          loading && "animate-pulse",
        )}
      >
        {unavailable ? "—" : format(animated)}
      </div>
      {sparkline && !unavailable ? <Sparkline data={sparkline} className={tone} /> : <div className="h-5" />}
    </div>
  );
}

export function KpiBar() {
  const { t } = useT();
  const { tick } = useLive();
  const [s, setS] = useState<Stats | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch("/api/stats")
        .then((r) => (r.ok ? (r.json() as Promise<Stats>) : Promise.reject(new Error("bad status"))))
        .then((d: Stats) => {
          if (cancelled) return;
          setS(d);
          setError(false);
        })
        .catch(() => {
          if (!cancelled) setError(true);
        });
    load();
    const poll = setInterval(load, 15_000);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, [tick]);

  // Before any successful load: pulse (loading) or, if the fetch failed, show
  // "—" (unavailable) instead of fake zeros.
  const loading = s === null && !error;
  const unavailable = s === null && error;

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
      <Stat icon={Radio} label={t("kpi.active")} value={d.activeSessions} format={(n) => String(Math.round(n))} loading={loading} unavailable={unavailable} />
      <Stat
        icon={Activity}
        label={t("kpi.events")}
        value={d.eventsToday}
        format={(n) => formatCompact(Math.round(n))}
        sparkline={d.sparkline}
        loading={loading}
        unavailable={unavailable}
      />
      <Stat
        icon={Hammer}
        label={t("kpi.tools")}
        value={d.toolCallsToday}
        format={(n) => formatCompact(Math.round(n))}
        tone="text-sky-400"
        loading={loading}
        unavailable={unavailable}
      />
      <Stat
        icon={AlertTriangle}
        label={t("kpi.errors")}
        value={d.errorRate}
        format={(n) => `${Math.round(n * 100)}%`}
        tone={errorTone(d.errorRate)}
        loading={loading}
        unavailable={unavailable}
      />
      <Stat
        icon={Coins}
        label={t("kpi.cost")}
        value={d.costTodayUsd}
        format={(n) => formatMoney(n, "USD")}
        tone="text-emerald-400"
        loading={loading}
        unavailable={unavailable}
      />
    </div>
  );
}
