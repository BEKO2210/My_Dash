"use client";

import Link from "next/link";
import { ArrowUpRight, MessageSquare } from "lucide-react";
import { Panel } from "@/components/panel";
import { WidgetState } from "@/components/widget-state";
import { usePluginQuery } from "@/components/plugin-data";
import { viewState } from "@/components/widget-view";
import { useView, ViewSwitch } from "@/components/view-variant";
import type { ViewOption } from "@/plugins/registry";
import { useSearch, matchesQuery } from "@/components/search";
import { useT } from "@/lib/i18n";
import { formatCompact, relativeTime } from "@/lib/format";
import type { PromptHistoryItem } from "@/lib/prompts";

// Phase F (F15): timeline (default, today's rail+dots) ↔ compact (dense rows).
const WIDGET_ID = "prompt-history";
const VIEW_VALUES = ["timeline", "compact"] as const;
export const PROMPT_HISTORY_VIEWS: ViewOption[] = [
  { value: "timeline", label: "view.timeline" },
  { value: "compact", label: "view.compact" },
];

export function PromptHistory() {
  const { query, setQuery } = useSearch();
  const { t, lang } = useT();
  const view = useView(WIDGET_ID, VIEW_VALUES, "timeline");
  const q = usePluginQuery<{ prompts: PromptHistoryItem[] }>("/api/prompts?limit=100");

  const prompts = q.data?.prompts ?? [];
  const vs = viewState(q, () => prompts.length === 0);
  const filtered = prompts.filter((p) => matchesQuery(query, p.text, p.project));

  return (
    <Panel
      title={t("prompts.title")}
      icon={<MessageSquare className="h-4 w-4 text-accent" />}
      info={t("prompts.info")}
      right={<ViewSwitch widgetId={WIDGET_ID} options={PROMPT_HISTORY_VIEWS} value={view} t={t} />}
    >
      {vs === "error" ? (
        <WidgetState icon={MessageSquare} title={t("common.loadError")} onRetry={q.refetch} retryLabel={t("common.retry")} />
      ) : vs === "loading" ? (
        <WidgetState icon={MessageSquare} title={t("common.loading")} loading />
      ) : vs === "empty" ? (
        <WidgetState icon={MessageSquare} title={t("prompts.empty")} />
      ) : filtered.length === 0 ? (
        // Prompts exist but the dashboard-wide search filter (often set by clicking a
        // file tile / graph node, and kept in the URL ?q=) hides them all. Say so and
        // offer a one-click clear, so an empty list never looks like missing data.
        <WidgetState
          icon={MessageSquare}
          title={t("prompts.noMatch")}
          description={<span className="font-mono">{`„${query}"`}</span>}
          onRetry={() => setQuery("")}
          retryLabel={t("search.clear")}
        />
      ) : view === "compact" ? (
        <ul tabIndex={0} className="flex h-full flex-col divide-y divide-panel-border/50 overflow-auto outline-none">
          {filtered.map((p) => (
            <li key={p.id} className="mc-stream-in">
              <Link
                href={`/session?id=${encodeURIComponent(p.session_id)}`}
                title={t("prompts.openSession")}
                className="group/row flex items-baseline gap-2 px-3 py-1.5 transition-colors hover:bg-white/[0.03]"
              >
                <span className="min-w-0 flex-1 truncate text-xs text-foreground">{p.text}</span>
                <span className="shrink-0 whitespace-nowrap text-[10px] text-muted">{relativeTime(p.created_at, lang)}</span>
                {/* Click affordance: the row opens the session — a faint arrow on hover says so.
                    Named group (group/row) so only the hovered row shows it — the widget cell
                    itself is an unnamed `group`, which would otherwise reveal every row at once. */}
                <ArrowUpRight
                  className="h-3 w-3 shrink-0 self-center text-accent opacity-0 transition-opacity group-hover/row:opacity-100"
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <ol className="relative ml-4 border-l border-panel-border/70 py-2 pr-4">
          {filtered.map((p) => (
            <li key={p.id} className="mc-stream-in relative py-2 pl-5">
              <span className="absolute -left-[5px] top-3.5 h-2.5 w-2.5 rounded-full border-2 border-panel bg-accent" />
              <Link
                href={`/session?id=${encodeURIComponent(p.session_id)}`}
                title={t("prompts.openSession")}
                className="group/row -mx-1 block rounded-md px-1 py-0.5 transition-colors hover:bg-white/[0.03]"
              >
                <p className="whitespace-pre-wrap break-words text-sm text-foreground">{p.text}</p>
                <div className="mt-1 flex items-center gap-2 text-[11px] text-muted">
                  <span className="truncate font-mono" title={p.project}>
                    {p.project}
                  </span>
                  <span aria-hidden>·</span>
                  <span className="whitespace-nowrap">{relativeTime(p.created_at, lang)}</span>
                  {p.token_estimate > 0 && (
                    <>
                      <span aria-hidden>·</span>
                      <span className="whitespace-nowrap tabular-nums">
                        ~{formatCompact(p.token_estimate)} {t("prompts.tokens")}
                      </span>
                    </>
                  )}
                  {/* Click affordance: the row is a link to its session. Named group
                      (group/row) so only the hovered row reveals it. */}
                  <span className="ml-auto flex items-center gap-0.5 whitespace-nowrap text-accent opacity-0 transition-opacity group-hover/row:opacity-100">
                    <ArrowUpRight className="h-3 w-3" aria-hidden />
                    {t("prompts.openSession")}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}
