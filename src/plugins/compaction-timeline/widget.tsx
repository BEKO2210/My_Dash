"use client";

import { Layers } from "lucide-react";
import { Panel } from "@/components/panel";
import { WidgetState } from "@/components/widget-state";
import { usePluginQuery } from "@/components/plugin-data";
import { viewState } from "@/components/widget-view";
import { useT } from "@/lib/i18n";
import { relativeTime } from "@/lib/format";
import { compactionDaily, compactionSummary, type Compaction } from "@/lib/compaction";

const TRIGGER_COLOR: Record<string, string> = {
  manual: "bg-amber-400/15 text-amber-400",
  auto: "bg-sky-400/15 text-sky-400",
};

export function CompactionTimeline() {
  const { t, lang } = useT();
  const q = usePluginQuery<{ compactions: Compaction[] }>("/api/compactions?limit=100");

  const compactions = q.data?.compactions ?? [];
  const summary = compactionSummary(compactions);
  const days = compactionDaily(compactions, 14);
  const max = days.reduce((m, d) => Math.max(m, d.count), 0) || 1;
  const vs = viewState(q, () => compactions.length === 0);

  return (
    <Panel title={t("compaction.title")} icon={<Layers className="h-4 w-4 text-accent" />} info={t("compaction.info")}>
      {vs === "error" ? (
        <WidgetState icon={Layers} title={t("common.loadError")} onRetry={q.refetch} retryLabel={t("common.retry")} />
      ) : vs === "loading" ? (
        <WidgetState icon={Layers} title={t("common.loading")} loading />
      ) : vs === "empty" ? (
        <WidgetState icon={Layers} title={t("compaction.empty")} description={t("compaction.emptyHint")} />
      ) : (
        <div className="flex h-full flex-col gap-3 p-4">
          <div className="grid grid-cols-4 gap-2 text-center">
            <Stat value={String(summary.total)} label={t("compaction.total")} accent />
            <Stat value={String(summary.auto)} label={t("compaction.auto")} />
            <Stat value={String(summary.manual)} label={t("compaction.manual")} />
            <Stat value={relativeTime(compactions[0]?.created_at, lang)} label={t("compaction.last")} />
          </div>

          <div className="min-w-0">
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted">
              {t("compaction.perDay")}
            </p>
            <div className="flex h-10 items-end gap-px">
              {days.map((d) => (
                <div
                  key={d.date}
                  title={`${d.date}: ${d.count}`}
                  className="flex-1 rounded-t-sm bg-accent/40 transition-[height]"
                  style={{ height: `${Math.max(d.count > 0 ? 10 : 2, (d.count / max) * 100)}%` }}
                />
              ))}
            </div>
          </div>

          <ul tabIndex={0} className="min-h-0 flex-1 space-y-1.5 overflow-auto outline-none">
            {compactions.slice(0, 30).map((c) => (
              <li key={c.id} className="mc-stream-in flex items-center gap-2 text-sm">
                <Layers className="h-3.5 w-3.5 shrink-0 text-orange-400" />
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${TRIGGER_COLOR[c.trigger] ?? TRIGGER_COLOR.auto}`}
                >
                  {t(`compaction.trigger.${c.trigger === "manual" ? "manual" : "auto"}`)}
                </span>
                <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted" title={c.customInstructions ?? c.session_id}>
                  {c.customInstructions ?? c.session_id.slice(0, 8)}
                </span>
                <span className="shrink-0 whitespace-nowrap text-[11px] text-muted">
                  {relativeTime(c.created_at, lang)}
                </span>
              </li>
            ))}
          </ul>
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
