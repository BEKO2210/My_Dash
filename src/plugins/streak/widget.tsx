"use client";

import { Flame } from "lucide-react";
import { Panel } from "@/components/panel";
import { WidgetState } from "@/components/widget-state";
import { usePluginQuery } from "@/components/plugin-data";
import { useT } from "@/lib/i18n";
import type { DayCount, StreakStats } from "@/lib/streak";

interface StreakData {
  streak: StreakStats;
  days: DayCount[];
  hours: number[];
  peakHour: number;
}

export function Streak() {
  const { t } = useT();
  const { data } = usePluginQuery<StreakData>("/api/streak?days=30");

  const empty = data && data.streak.totalSessions === 0;

  return (
    <Panel title={t("streak.title")} icon={<Flame className="h-4 w-4 text-accent" />} info={t("streak.info")}>
      {!data ? (
        <WidgetState icon={Flame} title={t("common.loading")} loading />
      ) : empty ? (
        <WidgetState icon={Flame} title={t("streak.empty")} />
      ) : (
        <div className="flex h-full flex-col gap-3 p-4">
          <div className="grid grid-cols-4 gap-2 text-center">
            <Stat value={`🔥 ${data.streak.current}`} label={t("streak.current")} accent />
            <Stat value={String(data.streak.longest)} label={t("streak.longest")} />
            <Stat value={String(data.streak.activeDays)} label={t("streak.activeDays")} />
            <Stat value={data.peakHour >= 0 ? `${String(data.peakHour).padStart(2, "0")}:00` : "—"} label={t("streak.peak")} />
          </div>

          <Bars
            label={t("streak.perDay")}
            values={data.days.map((d) => d.count)}
            labels={data.days.map((d) => d.date)}
            highlightLast
          />

          <Bars
            label={t("streak.peakHours")}
            values={data.hours}
            labels={data.hours.map((_, h) => `${String(h).padStart(2, "0")}:00`)}
            highlight={data.peakHour}
          />
        </div>
      )}
    </Panel>
  );
}

function Stat({ value, label, accent = false }: { value: string; label: string; accent?: boolean }) {
  return (
    <div className="rounded-lg bg-white/[0.03] px-2 py-1.5">
      <p className={`truncate font-mono text-sm tabular-nums ${accent ? "text-accent" : "text-foreground"}`}>
        {value}
      </p>
      <p className="truncate text-[10px] uppercase tracking-wide text-muted">{label}</p>
    </div>
  );
}

function Bars({
  label,
  values,
  labels,
  highlight = -1,
  highlightLast = false,
}: {
  label: string;
  values: number[];
  labels: string[];
  highlight?: number;
  highlightLast?: boolean;
}) {
  const max = values.reduce((m, v) => Math.max(m, v), 0) || 1;
  return (
    <div className="min-w-0">
      <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted">{label}</p>
      <div className="flex h-12 items-end gap-px">
        {values.map((v, i) => {
          const hot = i === highlight || (highlightLast && i === values.length - 1);
          return (
            <div
              key={labels[i]}
              title={`${labels[i]}: ${v}`}
              className={`flex-1 rounded-t-sm transition-[height] ${hot ? "bg-accent" : "bg-accent/30"}`}
              style={{ height: `${Math.max(v > 0 ? 8 : 2, (v / max) * 100)}%` }}
            />
          );
        })}
      </div>
    </div>
  );
}
