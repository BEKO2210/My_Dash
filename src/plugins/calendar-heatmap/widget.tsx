"use client";

import { CalendarRange } from "lucide-react";
import { Panel } from "@/components/panel";
import { WidgetState } from "@/components/widget-state";
import { usePluginQuery } from "@/components/plugin-data";
import { viewState } from "@/components/widget-view";
import { useT } from "@/lib/i18n";
import { formatCompact } from "@/lib/format";
import { buildCalendar, type CalDayCount } from "@/lib/calendar";

const LEVEL_BG = [
  "var(--mc-heat-0, rgba(255,255,255,0.04))",
  "rgba(79,140,255,0.28)",
  "rgba(79,140,255,0.48)",
  "rgba(79,140,255,0.7)",
  "rgba(79,140,255,0.95)",
];

const PITCH = 13; // cell (10px) + gap (3px)

export function CalendarHeatmap() {
  const { t, lang } = useT();
  const q = usePluginQuery<{ days: CalDayCount[] }>("/api/calendar?days=371", { pollMs: 30_000 });

  const cal = buildCalendar(q.data?.days ?? []);
  const vs = viewState(q, () => cal.total === 0);
  const monthName = (m: number) =>
    new Date(Date.UTC(2026, m, 1)).toLocaleString(lang, { month: "short" });

  const segments = cal.months.map((m, i) => {
    const nextWeek = i + 1 < cal.months.length ? cal.months[i + 1].week : cal.weeks.length;
    return { month: m.month, lead: i === 0 ? m.week * PITCH : 0, width: (nextWeek - m.week) * PITCH };
  });

  return (
    <Panel
      title={t("calendar.title")}
      icon={<CalendarRange className="h-4 w-4 text-accent" />}
      info={t("calendar.info")}
      right={
        q.data && cal.total > 0 ? (
          <span className="text-xs text-muted">
            {formatCompact(cal.total)} {t("calendar.events")}
          </span>
        ) : undefined
      }
    >
      {vs === "error" ? (
        <WidgetState icon={CalendarRange} title={t("common.loadError")} onRetry={q.refetch} retryLabel={t("common.retry")} />
      ) : vs === "loading" ? (
        <WidgetState icon={CalendarRange} title={t("common.loading")} loading />
      ) : vs === "empty" ? (
        <WidgetState icon={CalendarRange} title={t("calendar.empty")} />
      ) : (
        <div tabIndex={0} className="flex h-full flex-col justify-center gap-2 overflow-auto p-4 outline-none">
          <div className="inline-flex min-w-min flex-col gap-1">
            <div className="flex text-[9px] text-muted">
              {segments.map((s, i) => (
                <span
                  key={i}
                  className="overflow-hidden whitespace-nowrap"
                  style={{ marginLeft: s.lead, width: s.width }}
                >
                  {monthName(s.month)}
                </span>
              ))}
            </div>
            <div className="flex gap-[3px]">
              {cal.weeks.map((wk, wi) => (
                <div key={wi} className="flex flex-col gap-[3px]">
                  {wk.map((cell, di) => (
                    <div
                      key={di}
                      title={cell ? `${cell.date}: ${cell.count}` : undefined}
                      className="h-2.5 w-2.5 rounded-[2px]"
                      style={{ backgroundColor: cell ? LEVEL_BG[cell.level] : "transparent" }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-end gap-1.5 text-[10px] text-muted">
            <span>{t("calendar.less")}</span>
            {LEVEL_BG.map((bg, i) => (
              <span key={i} className="h-2.5 w-2.5 rounded-[2px]" style={{ backgroundColor: bg }} />
            ))}
            <span>{t("calendar.more")}</span>
          </div>
        </div>
      )}
    </Panel>
  );
}
