"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock } from "lucide-react";
import { Panel } from "@/components/panel";
import { WidgetState } from "@/components/widget-state";
import { useLive } from "@/components/live-provider";
import { useT } from "@/lib/i18n";
import { foldHeatmap, level } from "@/lib/heatmap";
import type { ActivityBucket } from "@/lib/activity";

// 5-step blue ramp (level 0..4). Discrete for contrast; level 0 uses a faint base.
const LEVEL_BG = [
  "var(--mc-heat-0, rgba(255,255,255,0.04))",
  "rgba(79,140,255,0.28)",
  "rgba(79,140,255,0.48)",
  "rgba(79,140,255,0.7)",
  "rgba(79,140,255,0.95)",
];

const HOUR_LABELS = [0, 6, 12, 18];

export function Heatmap() {
  const { t, lang } = useT();
  const { tick } = useLive();
  const [buckets, setBuckets] = useState<ActivityBucket[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch("/api/activity?limit=5000")
        .then((r) => r.json())
        .then((d: { buckets: ActivityBucket[] }) => {
          if (!cancelled) setBuckets(d.buckets);
        })
        .catch(() => {});
    load();
    const poll = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, [tick]);

  const { grid, p95, total } = useMemo(() => foldHeatmap(buckets ?? []), [buckets]);

  const weekdays = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "de-DE", { weekday: "short" });
    return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(Date.UTC(2024, 0, 1 + i)))); // Jan 1 2024 = Monday
  }, [lang]);

  return (
    <Panel
      title={t("heatmap.title")}
      icon={<CalendarClock className="h-4 w-4 text-accent" />}
      info={t("heatmap.info")}
    >
      {!buckets ? (
        <WidgetState icon={CalendarClock} title={t("common.loading")} loading />
      ) : total === 0 ? (
        <WidgetState icon={CalendarClock} title={t("heatmap.empty")} />
      ) : (
        <div className="flex h-full flex-col justify-center gap-3 p-4">
          <div
            className="grid items-center gap-[3px]"
            style={{ gridTemplateColumns: "1.75rem repeat(24, minmax(0, 1fr))" }}
          >
            {grid.map((row, wd) => (
              <Row key={wd} label={weekdays[wd]} row={row} clamp={p95} hourTitle={t("heatmap.cell")} />
            ))}
            {/* hour axis */}
            <span />
            {Array.from({ length: 24 }, (_, h) => (
              <span key={h} className="text-center text-[9px] text-muted">
                {HOUR_LABELS.includes(h) ? h : ""}
              </span>
            ))}
          </div>
          <Legend lessLabel={t("heatmap.less")} moreLabel={t("heatmap.more")} />
        </div>
      )}
    </Panel>
  );
}

function Row({
  label,
  row,
  clamp,
  hourTitle,
}: {
  label: string;
  row: number[];
  clamp: number;
  hourTitle: string;
}) {
  return (
    <>
      <span className="pr-1 text-right text-[10px] text-muted">{label}</span>
      {row.map((count, h) => (
        <div
          key={h}
          className="aspect-square w-full rounded-[2px]"
          style={{ backgroundColor: LEVEL_BG[level(count, clamp)] }}
          title={`${label} ${String(h).padStart(2, "0")}:00 — ${count} ${hourTitle}`}
        />
      ))}
    </>
  );
}

function Legend({ lessLabel, moreLabel }: { lessLabel: string; moreLabel: string }) {
  return (
    <div className="flex items-center justify-end gap-1.5 text-[10px] text-muted">
      <span>{lessLabel}</span>
      {LEVEL_BG.map((bg, i) => (
        <span key={i} className="h-2.5 w-2.5 rounded-[2px]" style={{ backgroundColor: bg }} />
      ))}
      <span>{moreLabel}</span>
    </div>
  );
}
