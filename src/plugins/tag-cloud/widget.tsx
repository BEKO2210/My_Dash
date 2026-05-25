"use client";

import { Hash } from "lucide-react";
import { Panel } from "@/components/panel";
import { WidgetState } from "@/components/widget-state";
import { usePluginQuery } from "@/components/plugin-data";
import { viewState } from "@/components/widget-view";
import { useView, ViewSwitch } from "@/components/view-variant";
import type { ViewOption } from "@/plugins/registry";
import { useSearch, matchesQuery } from "@/components/search";
import { useT } from "@/lib/i18n";
import type { TermCount } from "@/lib/tags";

// Phase F (F6): cloud (default, today's look) ↔ list (ranked term · count rows).
const WIDGET_ID = "tag-cloud";
const VIEW_VALUES = ["cloud", "list"] as const;
export const TAG_CLOUD_VIEWS: ViewOption[] = [
  { value: "cloud", label: "view.cloud" },
  { value: "list", label: "view.list" },
];

export function TagCloud() {
  const { query, setQuery } = useSearch();
  const { t } = useT();
  const view = useView(WIDGET_ID, VIEW_VALUES, "cloud");
  const q = usePluginQuery<{ terms: TermCount[] }>("/api/tags?limit=40");

  const terms = q.data?.terms ?? [];
  const vs = viewState(q, () => terms.length === 0);
  const filtered = terms.filter((tc) => matchesQuery(query, tc.term));
  const max = filtered.reduce((m, t) => Math.max(m, t.count), 0) || 1;
  const min = filtered.reduce((m, t) => Math.min(m, t.count), max);

  // 0..1 weight; size and font-weight both encode frequency (stronger than colour alone).
  const scale = (c: number) => (max === min ? 0.5 : (c - min) / (max - min));

  return (
    <Panel
      title={t("tags.title")}
      icon={<Hash className="h-4 w-4 text-accent" />}
      info={t("tags.info")}
      right={<ViewSwitch widgetId={WIDGET_ID} options={TAG_CLOUD_VIEWS} value={view} t={t} />}
    >
      {vs === "error" ? (
        <WidgetState icon={Hash} title={t("common.loadError")} onRetry={q.refetch} retryLabel={t("common.retry")} />
      ) : vs === "loading" ? (
        <WidgetState icon={Hash} title={t("common.loading")} loading />
      ) : vs === "empty" ? (
        <WidgetState icon={Hash} title={t("tags.empty")} description={t("tags.emptyHint")} />
      ) : filtered.length === 0 ? (
        <WidgetState icon={Hash} title={t("common.noResults")} />
      ) : view === "list" ? (
        <TagList items={filtered} max={max} onPick={setQuery} />
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

// List view: terms ranked by count, each a clickable row (sets the search query)
// with a small frequency bar — same data + interaction as the cloud.
function TagList({ items, max, onPick }: { items: TermCount[]; max: number; onPick: (term: string) => void }) {
  const sorted = [...items].sort((a, b) => b.count - a.count);
  return (
    <ul tabIndex={0} className="flex h-full flex-col gap-1 overflow-auto p-3 outline-none">
      {sorted.map((tc) => (
        <li key={tc.term}>
          <button
            type="button"
            onClick={() => onPick(tc.term)}
            title={`${tc.term}: ${tc.count}`}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs transition-colors hover:bg-white/[0.03]"
          >
            <Hash className="h-3 w-3 shrink-0 text-muted" />
            <span className="min-w-0 flex-1 truncate text-foreground">{tc.term}</span>
            <span className="relative h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-background/70">
              <span
                className="absolute inset-y-0 left-0 rounded-full bg-accent/60"
                style={{ width: `${Math.max(4, (tc.count / max) * 100)}%` }}
              />
            </span>
            <span className="w-8 shrink-0 text-right tabular-nums text-muted">{tc.count}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
