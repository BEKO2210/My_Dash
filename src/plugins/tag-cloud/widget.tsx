"use client";

import { useEffect, useState } from "react";
import { Hash } from "lucide-react";
import { Panel } from "@/components/panel";
import { WidgetState } from "@/components/widget-state";
import { useLive } from "@/components/live-provider";
import { useSearch, matchesQuery } from "@/components/search";
import { useT } from "@/lib/i18n";
import type { TermCount } from "@/lib/tags";

export function TagCloud() {
  const { tick } = useLive();
  const { query } = useSearch();
  const { t } = useT();
  const [terms, setTerms] = useState<TermCount[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch("/api/tags?limit=40")
        .then((r) => r.json())
        .then((d: { terms: TermCount[] }) => {
          if (!cancelled) setTerms(d.terms);
        })
        .catch(() => {});
    load();
    const poll = setInterval(load, 15_000);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, [tick]);

  const filtered = (terms ?? []).filter((t) => matchesQuery(query, t.term));
  const max = filtered.reduce((m, t) => Math.max(m, t.count), 0) || 1;
  const min = filtered.reduce((m, t) => Math.min(m, t.count), max);

  // 0..1 weight; size and font-weight both encode frequency (stronger than colour alone).
  const scale = (c: number) => (max === min ? 0.5 : (c - min) / (max - min));

  return (
    <Panel title={t("tags.title")} icon={<Hash className="h-4 w-4 text-accent" />} info={t("tags.info")}>
      {!terms ? (
        <WidgetState icon={Hash} title={t("common.loading")} loading />
      ) : terms.length === 0 ? (
        <WidgetState icon={Hash} title={t("tags.empty")} description={t("tags.emptyHint")} />
      ) : filtered.length === 0 ? (
        <WidgetState icon={Hash} title={t("common.noResults")} />
      ) : (
        <div className="flex h-full flex-wrap content-start items-baseline gap-x-3 gap-y-1.5 overflow-auto p-4 leading-tight">
          {filtered.map((tc) => {
            const s = scale(tc.count);
            return (
              <span
                key={tc.term}
                title={`${tc.term}: ${tc.count}`}
                className="cursor-default whitespace-nowrap transition-colors hover:text-accent"
                style={{
                  fontSize: `${0.72 + s * 1.0}rem`,
                  fontWeight: 400 + Math.round(s * 3) * 100,
                  color: `color-mix(in oklab, var(--color-accent) ${Math.round(40 + s * 60)}%, var(--color-muted))`,
                }}
              >
                {tc.term}
              </span>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
