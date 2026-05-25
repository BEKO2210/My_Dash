"use client";

import { useState } from "react";
import { Trophy } from "lucide-react";
import { Panel } from "@/components/panel";
import { WidgetState } from "@/components/widget-state";
import { usePluginQuery } from "@/components/plugin-data";
import { viewState } from "@/components/widget-view";
import { useView, ViewSwitch } from "@/components/view-variant";
import type { ViewOption } from "@/plugins/registry";
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

// Phase F (F5): table (default, today's look) ↔ bars (ranked by the chosen metric).
const WIDGET_ID = "project-leaderboard";
const VIEW_VALUES = ["table", "bars"] as const;
export const PROJECT_LEADERBOARD_VIEWS: ViewOption[] = [
  { value: "table", label: "view.table" },
  { value: "bars", label: "view.bars" },
];

export function ProjectLeaderboard() {
  const { t } = useT();
  const [sort, setSort] = useState<SortKey>("costUsd");
  const view = useView(WIDGET_ID, VIEW_VALUES, "table");
  const q = usePluginQuery<{ projects: ProjectUsage[] }>("/api/usage/projects");

  const sorted = [...(q.data?.projects ?? [])].sort((a, b) => b[sort] - a[sort]);
  const vs = viewState(q, () => sorted.length === 0);

  const cell = (p: ProjectUsage, key: SortKey) =>
    key === "costUsd"
      ? formatMoney(p.costUsd, "USD")
      : key === "totalTokens"
        ? formatCompact(p.totalTokens)
        : String(p[key]);

  return (
    <Panel
      title={t("leaderboard.title")}
      icon={<Trophy className="h-4 w-4 text-accent" />}
      info={t("leaderboard.info")}
      right={
        <div className="flex items-center gap-1.5">
          {view === "bars" && (
            <div className="flex rounded-md border border-panel-border text-xs">
              {COLUMNS.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setSort(c.key)}
                  aria-pressed={sort === c.key}
                  className={`px-2 py-1 ${sort === c.key ? "bg-accent/20 text-accent" : "text-muted hover:text-foreground"}`}
                >
                  {t(c.label)}
                </button>
              ))}
            </div>
          )}
          <ViewSwitch widgetId={WIDGET_ID} options={PROJECT_LEADERBOARD_VIEWS} value={view} t={t} />
        </div>
      }
    >
      {vs === "error" ? (
        <WidgetState icon={Trophy} title={t("common.loadError")} onRetry={q.refetch} retryLabel={t("common.retry")} />
      ) : vs === "loading" ? (
        <WidgetState icon={Trophy} title={t("common.loading")} loading />
      ) : vs === "empty" ? (
        <WidgetState icon={Trophy} title={t("leaderboard.empty")} />
      ) : view === "bars" ? (
        <LeaderboardBars sorted={sorted} sort={sort} cell={cell} />
      ) : (
        <div className="h-full overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-panel/95 text-muted backdrop-blur">
              <tr>
                <th className="px-2 py-2 text-left font-medium">#</th>
                <th className="px-2 py-2 text-left font-medium">{t("leaderboard.project")}</th>
                {COLUMNS.map((c) => (
                  <th
                    key={c.key}
                    aria-sort={sort === c.key ? "descending" : "none"}
                    className="px-2 py-2 text-right font-medium"
                  >
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

// Bars view: projects ranked by the selected metric as horizontal bars.
function LeaderboardBars({
  sorted,
  sort,
  cell,
}: {
  sorted: ProjectUsage[];
  sort: SortKey;
  cell: (p: ProjectUsage, key: SortKey) => string;
}) {
  const max = Math.max(1, ...sorted.map((p) => p[sort]));
  return (
    <ul tabIndex={0} className="flex h-full flex-col gap-2 overflow-auto p-4 outline-none">
      {sorted.map((p, i) => (
        <li key={p.project}>
          <div className="mb-1 flex items-center justify-between gap-2 text-xs">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="w-5 shrink-0 text-center tabular-nums text-muted">{MEDAL[i] ?? i + 1}</span>
              <span className="truncate text-foreground" title={p.project}>{p.project}</span>
            </span>
            <span className="shrink-0 tabular-nums text-muted">{cell(p, sort)}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-background/70">
            <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(2, (p[sort] / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
