"use client";

import { Hash } from "lucide-react";
import { Panel } from "@/components/panel";
import { WidgetState } from "@/components/widget-state";
import { usePluginQuery } from "@/components/plugin-data";
import { viewState } from "@/components/widget-view";
import { useSearch, matchesQuery } from "@/components/search";
import { useT } from "@/lib/i18n";
import type { TermCount } from "@/lib/tags";

export function TagCloud() {
  const { query, setQuery } = useSearch();
  const { t } = useT();
  const q = usePluginQuery<{ terms: TermCount[] }>("/api/tags?limit=40");

  const terms = q.data?.terms ?? [];
  const vs = viewState(q, () => terms.length === 0);
  const filtered = terms.filter((tc) => matchesQuery(query, tc.term));
  const max = filtered.reduce((m, t) => Math.max(m, t.count), 0) || 1;
  const min = filtered.reduce((m, t) => Math.min(m, t.count), max);

  // 0..1 weight; size and font-weight both encode frequency (stronger than colour alone).
  const scale = (c: number) => (max === min ? 0.5 : (c - min) / (max - min));

  return (
    <Panel title={t("tags.title")} icon={<Hash className="h-4 w-4 text-accent" />} info={t("tags.info")}>
      {vs === "error" ? (
        <WidgetState icon={Hash} title={t("common.loadError")} onRetry={q.refetch} retryLabel={t("common.retry")} />
      ) : vs === "loading" ? (
        <WidgetState icon={Hash} title={t("common.loading")} loading />
      ) : vs === "empty" ? (
        <WidgetState icon={Hash} title={t("tags.empty")} description={t("tags.emptyHint")} />
      ) : filtered.length === 0 ? (
        <WidgetState icon={Hash} title={t("common.noResults")} />
      ) : (
        <div tabIndex={0} className="flex h-full flex-wrap content-start items-baseline gap-x-3 gap-y-1.5 overflow-auto p-4 leading-tight outline-none">
          {filtered.map((tc) => {
            const s = scale(tc.count);
            return (
              <button
                key={tc.term}
                type="button"
                onClick={() => setQuery(tc.term)}
                title={`${tc.term}: ${tc.count}`}
                className="cursor-pointer whitespace-nowrap bg-transparent p-0 transition-colors hover:text-accent"
                style={{
                  fontSize: `${0.72 + s * 1.0}rem`,
                  fontWeight: 400 + Math.round(s * 3) * 100,
                  color: `color-mix(in oklab, var(--color-accent) ${Math.round(40 + s * 60)}%, var(--color-muted))`,
                }}
              >
                {tc.term}
              </button>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
