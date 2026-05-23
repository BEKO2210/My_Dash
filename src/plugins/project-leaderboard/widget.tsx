"use client";

import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { Panel } from "@/components/panel";
import { WidgetState } from "@/components/widget-state";
import { useLive } from "@/components/live-provider";
import { useT } from "@/lib/i18n";
import { formatCompact, formatMoney } from "@/lib/format";
import type { ProjectUsage } from "@/lib/projects";

type SortKey = "costUsd" | "sessions" | "tools" | "totalTokens";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "sessions", label: "leaderboard.sessions" },
  { key: "tools", label: "leaderboard.tools" },
  { key: "totalTokens", label: "leaderboard.tokens" },
  { key: "costUsd", label: "leaderboard.cost" },
];

const MEDAL = ["🥇", "🥈", "🥉"];

export function ProjectLeaderboard() {
  const { t } = useT();
  const { tick } = useLive();
  const [projects, setProjects] = useState<ProjectUsage[] | null>(null);
  const [sort, setSort] = useState<SortKey>("costUsd");

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch("/api/usage/projects")
        .then((r) => r.json())
        .then((d: { projects: ProjectUsage[] }) => {
          if (!cancelled) setProjects(d.projects);
        })
        .catch(() => {});
    load();
    const poll = setInterval(load, 15_000);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, [tick]);

  const sorted = [...(projects ?? [])].sort((a, b) => b[sort] - a[sort]);

  const cell = (p: ProjectUsage, key: SortKey) =>
    key === "costUsd"
      ? formatMoney(p.costUsd, "USD")
      : key === "totalTokens"
        ? formatCompact(p.totalTokens)
        : String(p[key]);

  return (
    <Panel title={t("leaderboard.title")} icon={<Trophy className="h-4 w-4 text-accent" />} info={t("leaderboard.info")}>
      {!projects ? (
        <WidgetState icon={Trophy} title={t("common.loading")} loading />
      ) : sorted.length === 0 ? (
        <WidgetState icon={Trophy} title={t("leaderboard.empty")} />
      ) : (
        <div className="h-full overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-panel/95 text-muted backdrop-blur">
              <tr>
                <th className="px-2 py-2 text-left font-medium">#</th>
                <th className="px-2 py-2 text-left font-medium">{t("leaderboard.project")}</th>
                {COLUMNS.map((c) => (
                  <th key={c.key} className="px-2 py-2 text-right font-medium">
                    <button
                      onClick={() => setSort(c.key)}
                      className={`tabular-nums hover:text-foreground ${sort === c.key ? "text-accent" : ""}`}
                    >
                      {t(c.label)}
                      {sort === c.key ? " ↓" : ""}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((p, i) => (
                <tr key={p.project} className="border-t border-panel-border/50 transition-colors hover:bg-white/[0.03]">
                  <td className="px-2 py-1.5 tabular-nums text-muted">{MEDAL[i] ?? i + 1}</td>
                  <td className="max-w-[10rem] truncate px-2 py-1.5 text-foreground" title={p.project}>
                    {p.project}
                  </td>
                  {COLUMNS.map((c) => (
                    <td
                      key={c.key}
                      className={`px-2 py-1.5 text-right tabular-nums ${sort === c.key ? "text-foreground" : "text-muted"}`}
                    >
                      {cell(p, c.key)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
