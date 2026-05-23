"use client";

import { useEffect, useState } from "react";
import { GanttChartSquare } from "lucide-react";
import { Panel } from "@/components/panel";
import { WidgetState } from "@/components/widget-state";
import { useLive } from "@/components/live-provider";
import { useT } from "@/lib/i18n";
import { STATUS_META } from "@/lib/format";
import { timelineLayout, windowFor } from "@/lib/timeline";
import type { SessionRow } from "@/lib/types";

type Range = "1" | "7" | "30";
const RANGES: Range[] = ["1", "7", "30"];
const RANGE_LABEL: Record<Range, string> = {
  "1": "tokens.range24h",
  "7": "tools.range7d",
  "30": "tools.range30d",
};

const TICKS = 5;

function fmtDuration(ms: number, lang: string): string {
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 6) / 10;
  return lang === "en" ? `${h}h` : `${h}h`;
}

export function SessionTimeline() {
  const { t, lang } = useT();
  const { tick } = useLive();
  const [range, setRange] = useState<Range>("1");
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch("/api/sessions")
        .then((r) => r.json())
        .then((d: { sessions: SessionRow[] }) => {
          if (!cancelled) setSessions(d.sessions);
        })
        .catch(() => {});
    load();
    const poll = setInterval(load, 10_000);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, [tick]);

  // Recomputed each render (cheap); renders happen on the 10s poll, so the window
  // slides forward in time then.
  const days = Number(range);
  const { fromMs, toMs } = windowFor(days);
  const bars = timelineLayout(sessions ?? [], fromMs, toMs);
  const tickFmt = new Intl.DateTimeFormat(
    lang === "en" ? "en-GB" : "de-DE",
    days <= 1 ? { hour: "2-digit", minute: "2-digit" } : { day: "2-digit", month: "2-digit" },
  );
  const ticks = Array.from({ length: TICKS }, (_, i) =>
    tickFmt.format(new Date(fromMs + ((toMs - fromMs) * i) / (TICKS - 1))),
  );

  return (
    <Panel
      title={t("timeline.title")}
      icon={<GanttChartSquare className="h-4 w-4 text-accent" />}
      info={t("timeline.info")}
      right={
        <div className="flex rounded-md border border-panel-border text-xs">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-2 py-1 ${range === r ? "bg-accent/20 text-accent" : "text-muted hover:text-foreground"}`}
            >
              {t(RANGE_LABEL[r])}
            </button>
          ))}
        </div>
      }
    >
      {!sessions ? (
        <WidgetState icon={GanttChartSquare} title={t("common.loading")} loading />
      ) : bars.length === 0 ? (
        <WidgetState icon={GanttChartSquare} title={t("timeline.empty")} />
      ) : (
        <div className="flex h-full flex-col p-3">
          <div className="flex pb-1 text-[10px] text-muted/70">
            <span className="w-24 shrink-0" />
            <div className="relative flex-1">
              {ticks.map((label, i) => (
                <span
                  key={i}
                  className="absolute -translate-x-1/2 whitespace-nowrap"
                  style={{ left: `${(i / (TICKS - 1)) * 100}%` }}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
          <ul className="flex flex-1 flex-col gap-1 overflow-auto">
            {bars.map((b) => (
              <li key={b.id} className="flex items-center gap-2">
                <span className="w-24 shrink-0 truncate text-[11px] text-foreground" title={b.title}>
                  {b.title}
                </span>
                <div className="relative h-3 flex-1 rounded bg-background/50">
                  <div
                    className={`absolute top-0 h-3 rounded ${STATUS_META[b.status]?.dot ?? "bg-zinc-500"} opacity-80`}
                    style={{ left: `${b.leftPct}%`, width: `${b.widthPct}%` }}
                    title={`${b.title} · ${fmtDuration(b.endMs - b.startMs, lang)}${b.project ? ` · ${b.project}` : ""}`}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}
