"use client";

import { useState } from "react";
import { Bot, ChevronDown, ChevronRight, GitBranch, Layers } from "lucide-react";
import { Panel } from "@/components/panel";
import { WidgetState } from "@/components/widget-state";
import { usePluginQuery } from "@/components/plugin-data";
import { viewState } from "@/components/widget-view";
import { useSearch, matchesQuery } from "@/components/search";
import { useT } from "@/lib/i18n";
import { relativeTime } from "@/lib/format";
import type { SubagentGroup } from "@/lib/subagents";

export function SubagentTree() {
  const { query } = useSearch();
  const { t, lang } = useT();
  const q = usePluginQuery<{ groups: SubagentGroup[] }>("/api/subagents?limit=200");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const groups = q.data?.groups ?? [];
  const vs = viewState(q, () => groups.length === 0);

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const filtered = groups.filter((g) =>
    matchesQuery(query, g.title, g.project, ...g.tasks.map((tk) => tk.label)),
  );

  return (
    <Panel title={t("subagents.title")} icon={<GitBranch className="h-4 w-4 text-accent" />} info={t("subagents.info")}>
      {vs === "error" ? (
        <WidgetState icon={GitBranch} title={t("common.loadError")} onRetry={q.refetch} retryLabel={t("common.retry")} />
      ) : vs === "loading" ? (
        <WidgetState icon={GitBranch} title={t("common.loading")} loading />
      ) : vs === "empty" ? (
        <WidgetState icon={GitBranch} title={t("subagents.empty")} description={t("subagents.emptyHint")} />
      ) : filtered.length === 0 ? (
        <WidgetState icon={GitBranch} title={t("common.noResults")} />
      ) : (
        <ul className="py-1">
          {filtered.map((g) => {
            const open = !collapsed.has(g.session_id);
            return (
              <li key={g.session_id} className="mc-stream-in">
                <button
                  onClick={() => toggle(g.session_id)}
                  aria-expanded={open}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-white/[0.03]"
                >
                  {open ? (
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted" />
                  )}
                  <Layers className="h-4 w-4 shrink-0 text-sky-400" />
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground" title={g.title ?? g.session_id}>
                    {g.title ?? g.session_id.slice(0, 8)}
                  </span>
                  <span className="shrink-0 rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-accent">
                    {g.count}
                  </span>
                  <span className="hidden shrink-0 truncate font-mono text-[11px] text-muted sm:inline" title={g.project}>
                    {g.project}
                  </span>
                </button>
                {open && (
                  <ul className="ml-[19px] border-l border-panel-border/70">
                    {g.tasks.map((tk) => (
                      <li key={tk.id} className="flex items-center gap-2 py-1 pl-4 pr-3 text-sm">
                        <Bot className="h-3.5 w-3.5 shrink-0 text-violet-400" />
                        <span className="min-w-0 flex-1 truncate text-foreground" title={tk.label ?? undefined}>
                          {tk.label ?? t("subagents.unnamed")}
                        </span>
                        <span className="shrink-0 whitespace-nowrap text-[11px] text-muted">
                          {relativeTime(tk.created_at, lang)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
