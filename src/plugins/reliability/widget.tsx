"use client";

import { ShieldCheck } from "lucide-react";
import { Panel } from "@/components/panel";
import { WidgetState } from "@/components/widget-state";
import { usePluginQuery } from "@/components/plugin-data";
import { useSearch, matchesQuery } from "@/components/search";
import { useT } from "@/lib/i18n";
import { formatCompact } from "@/lib/format";
import type { ProjectReliability } from "@/lib/reliability";

function rateColor(rate: number): { bar: string; text: string } {
  if (rate >= 0.95) return { bar: "bg-emerald-400", text: "text-emerald-400" };
  if (rate >= 0.85) return { bar: "bg-amber-400", text: "text-amber-400" };
  return { bar: "bg-red-400", text: "text-red-400" };
}

export function Reliability() {
  const { query } = useSearch();
  const { t } = useT();
  const q = usePluginQuery<{ projects: ProjectReliability[] }>("/api/reliability?limit=100");
  const projects = q.data?.projects ?? null;

  const filtered = (projects ?? []).filter((p) => matchesQuery(query, p.project));

  return (
    <Panel title={t("reliability.title")} icon={<ShieldCheck className="h-4 w-4 text-accent" />} info={t("reliability.info")}>
      {q.error && !projects ? (
        <WidgetState icon={ShieldCheck} title={t("common.loadError")} onRetry={q.refetch} retryLabel={t("common.retry")} />
      ) : !projects ? (
        <WidgetState icon={ShieldCheck} title={t("common.loading")} loading />
      ) : projects.length === 0 ? (
        <WidgetState icon={ShieldCheck} title={t("reliability.empty")} />
      ) : filtered.length === 0 ? (
        <WidgetState icon={ShieldCheck} title={t("common.noResults")} />
      ) : (
        <ul tabIndex={0} className="flex h-full flex-col justify-center gap-2.5 overflow-auto p-4 outline-none">
          {filtered.map((p) => {
            const c = rateColor(p.successRate);
            return (
              <li key={p.project} className="mc-stream-in">
                <div className="mb-0.5 flex items-baseline justify-between gap-2 text-xs">
                  <span className="truncate font-mono text-foreground" title={p.project}>
                    {p.project}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted">
                    <span className={c.text}>{(p.successRate * 100).toFixed(0)}%</span> ·{" "}
                    {formatCompact(p.total)} · {p.failures} {t("reliability.fail")}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.05]">
                  <div className={`h-full rounded-full ${c.bar} transition-[width]`} style={{ width: `${p.successRate * 100}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
