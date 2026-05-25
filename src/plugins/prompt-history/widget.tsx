"use client";

import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { Panel } from "@/components/panel";
import { WidgetState } from "@/components/widget-state";
import { usePluginQuery } from "@/components/plugin-data";
import { viewState } from "@/components/widget-view";
import { useSearch, matchesQuery } from "@/components/search";
import { useT } from "@/lib/i18n";
import { formatCompact, relativeTime } from "@/lib/format";
import type { PromptHistoryItem } from "@/lib/prompts";

export function PromptHistory() {
  const { query } = useSearch();
  const { t, lang } = useT();
  const q = usePluginQuery<{ prompts: PromptHistoryItem[] }>("/api/prompts?limit=100");

  const prompts = q.data?.prompts ?? [];
  const vs = viewState(q, () => prompts.length === 0);
  const filtered = prompts.filter((p) => matchesQuery(query, p.text, p.project));

  return (
    <Panel
      title={t("prompts.title")}
      icon={<MessageSquare className="h-4 w-4 text-accent" />}
      info={t("prompts.info")}
    >
      {vs === "error" ? (
        <WidgetState icon={MessageSquare} title={t("common.loadError")} onRetry={q.refetch} retryLabel={t("common.retry")} />
      ) : vs === "loading" ? (
        <WidgetState icon={MessageSquare} title={t("common.loading")} loading />
      ) : vs === "empty" ? (
        <WidgetState icon={MessageSquare} title={t("prompts.empty")} />
      ) : filtered.length === 0 ? (
        <WidgetState icon={MessageSquare} title={t("common.noResults")} />
      ) : (
        <ol className="relative ml-4 border-l border-panel-border/70 py-2 pr-4">
          {filtered.map((p) => (
            <li key={p.id} className="mc-stream-in relative py-2 pl-5">
              <span className="absolute -left-[5px] top-3.5 h-2.5 w-2.5 rounded-full border-2 border-panel bg-accent" />
              <Link
                href={`/session?id=${encodeURIComponent(p.session_id)}`}
                className="-mx-1 block rounded-md px-1 py-0.5 transition-colors hover:bg-white/[0.03]"
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
                </div>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}
