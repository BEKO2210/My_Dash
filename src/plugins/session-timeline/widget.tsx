"use client";

import { useState } from "react";
import { GanttChartSquare } from "lucide-react";
import { Panel } from "@/components/panel";
import { WidgetState } from "@/components/widget-state";
import { usePluginQuery } from "@/components/plugin-data";
import { viewState } from "@/components/widget-view";
import { useView, ViewSwitch } from "@/components/view-variant";
import type { ViewOption } from "@/plugins/registry";
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

// Phase F (F10): timeline (default, today's Gantt look) ↔ list (rows by recency).
const WIDGET_ID = "session-timeline";
const VIEW_VALUES = ["timeline", "list"] as const;
export const SESSION_TIMELINE_VIEWS: ViewOption[] = [
  { value: "timeline", label: "view.timeline" },
  { value: "list", label: "view.list" },
];

type Bar = ReturnType<typeof timelineLayout>[number];

function fmtDuration(ms: number, lang: string): string {
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 6) / 10;
  return lang === "en" ? `${h}h` : `${h}h`;
}

// List view: sessions in the window as rows (status · title · project · duration),
// most-recent first — a denser alternative to the Gantt timeline.
function TimelineList({ bars, lang, t }: { bars: Bar[]; lang: string; t: (key: string) => string }) {
  const sorted = [...bars].sort((a, b) => b.startMs - a.startMs);
  return (
    <ul tabIndex={0} className="flex h-full flex-col gap-1 overflow-auto p-3 text-xs outline-none">
      {sorted.map((b) => (
        <li key={b.id} className="flex items-center gap-2">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${STATUS_META[b.status]?.dot ?? "bg-zinc-500"}`}
            title={t(`status.${b.status}`)}
          />
          <span className="min-w-0 flex-1 truncate text-foreground" title={b.title}>{b.title}</span>
          {b.project && (
            <span className="hidden max-w-[8rem] shrink-0 truncate font-mono text-[11px] text-muted sm:inline">
              {b.project}
            </span>
          )}
          <span className="shrink-0 tabular-nums text-muted">{fmtDuration(b.endMs - b.startMs, lang)}</span>
        </li>
      ))}
    </ul>
  );
}

export function SessionTimeline() {
  const { t, lang } = useT();
  const [range, setRange] = useState<Range>("1");
  const view = useView(WIDGET_ID, VIEW_VALUES, "timeline");
  const q = usePluginQuery<{ sessions: SessionRow[] }>("/api/sessions", { pollMs: 10_000 });

  // Recomputed each render (cheap); renders happen on the 10s poll, so the window
  // slides forward in time then.
  const days = Number(range);
  const { fromMs, toMs } = windowFor(days);
  const bars = timelineLayout(q.data?.sessions ?? [], fromMs, toMs);
  const vs = viewState(q, () => bars.length === 0);
  const tickFmt = new Intl.DateTimeFormat(
    lang === "en" ? "en-GB" : "de-DE",
    days <= 1 ? { hour: "2-digit", minute: "2-digit" } : { day: "2-digit", month: "2-digit" },
  );
  const ticks = Array.from({ length: TICKS }, (_, i) => {
    const at = fromMs + ((toMs - fromMs) * i) / (TICKS - 1);
    return { at, label: tickFmt.format(new Date(at)) };
  });

  return (
    <Panel
      title={t("timeline.title")}
      icon={<GanttChartSquare className="h-4 w-4 text-accent" />}
      info={t("timeline.info")}
      right={
        <div className="flex items-center gap-1.5">
          <div className="flex rounded-md border border-panel-border text-xs">
            {RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                aria-pressed={range === r}
                className={`px-2 py-1 ${range === r ? "bg-accent/20 text-accent" : "text-muted hover:text-foreground"}`}
              >
                {t(RANGE_LABEL[r])}
              </button>
            ))}
          </div>
          <ViewSwitch widgetId={WIDGET_ID} options={SESSION_TIMELINE_VIEWS} value={view} t={t} />
        </div>
      }
    >
      {vs === "error" ? (
        <WidgetState icon={GanttChartSquare} title={t("common.loadError")} onRetry={q.refetch} retryLabel={t("common.retry")} />
      ) : vs === "loading" ? (
        <WidgetState icon={GanttChartSquare} title={t("common.loading")} loading />
      ) : vs === "empty" ? (
        <WidgetState icon={GanttChartSquare} title={t("timeline.empty")} />
      ) : view === "list" ? (
        <TimelineList bars={bars} lang={lang} t={t} />
      ) : (
        <div className="flex h-full flex-col p-3">
          <div className="flex pb-2 text-[10px] text-muted">
            <span className="w-24 shrink-0" />
            {/* h-4 gives the absolutely-positioned tick labels their own band so
                they sit above the bars instead of overlapping the first row. */}
            <div className="relative h-4 flex-1">
              {ticks.map((tk, i) => (
                <span
                  key={tk.at}
                  className="absolute top-0 -translate-x-1/2 whitespace-nowrap"
                  style={{ left: `${(i / (TICKS - 1)) * 100}%` }}
                >
                  {tk.label}
                </span>
              ))}
            </div>
          </div>
          <ul tabIndex={0} className="flex flex-1 flex-col gap-1 overflow-auto outline-none">
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
