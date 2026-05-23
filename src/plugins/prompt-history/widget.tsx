"use client";

import { useEffect, useState } from "react";
import { MessageSquare } from "lucide-react";
import { Panel } from "@/components/panel";
import { WidgetState } from "@/components/widget-state";
import { useLive } from "@/components/live-provider";
import { useSearch, matchesQuery } from "@/components/search";
import { useT } from "@/lib/i18n";
import { formatCompact, relativeTime } from "@/lib/format";
import type { PromptHistoryItem } from "@/lib/prompts";

export function PromptHistory() {
  const { tick } = useLive();
  const { query } = useSearch();
  const { t, lang } = useT();
  const [prompts, setPrompts] = useState<PromptHistoryItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch("/api/prompts?limit=100")
        .then((r) => r.json())
        .then((d: { prompts: PromptHistoryItem[] }) => {
          if (!cancelled) setPrompts(d.prompts);
        })
        .catch(() => {});
    load();
    const poll = setInterval(load, 15_000);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, [tick]);

  const filtered = (prompts ?? []).filter((p) => matchesQuery(query, p.text, p.project));

  return (
    <Panel
      title={t("prompts.title")}
      icon={<MessageSquare className="h-4 w-4 text-accent" />}
      info={t("prompts.info")}
    >
      {!prompts ? (
        <WidgetState icon={MessageSquare} title={t("common.loading")} loading />
      ) : prompts.length === 0 ? (
        <WidgetState icon={MessageSquare} title={t("prompts.empty")} />
      ) : filtered.length === 0 ? (
        <WidgetState icon={MessageSquare} title={t("common.noResults")} />
      ) : (
        <ol className="relative ml-4 border-l border-panel-border/70 py-2 pr-4">
          {filtered.map((p) => (
            <li key={p.id} className="mc-stream-in relative py-2 pl-5">
              <span className="absolute -left-[5px] top-3.5 h-2.5 w-2.5 rounded-full border-2 border-panel bg-accent" />
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
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}
