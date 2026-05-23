"use client";

import { useEffect, useState } from "react";
import { CalendarRange } from "lucide-react";
import { Panel } from "@/components/panel";
import { WidgetState } from "@/components/widget-state";
import { useLive } from "@/components/live-provider";
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
  const { tick } = useLive();
  const { t, lang } = useT();
  const [days, setDays] = useState<CalDayCount[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch("/api/calendar?days=371")
        .then((r) => r.json())
        .then((d: { days: CalDayCount[] }) => {
          if (!cancelled) setDays(d.days);
        })
        .catch(() => {});
    load();
    const poll = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, [tick]);

  const cal = buildCalendar(days ?? []);
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
        days && cal.total > 0 ? (
          <span className="text-xs text-muted">
            {formatCompact(cal.total)} {t("calendar.events")}
          </span>
        ) : undefined
      }
    >
      {!days ? (
        <WidgetState icon={CalendarRange} title={t("common.loading")} loading />
      ) : cal.total === 0 ? (
        <WidgetState icon={CalendarRange} title={t("calendar.empty")} />
      ) : (
        <div className="flex h-full flex-col justify-center gap-2 overflow-auto p-4">
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
