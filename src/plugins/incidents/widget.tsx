"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { Panel } from "@/components/panel";
import { WidgetState } from "@/components/widget-state";
import { ToolCallInspector } from "@/components/tool-call-inspector";
import { useLive } from "@/components/live-provider";
import { useSearch, matchesQuery } from "@/components/search";
import { useT } from "@/lib/i18n";
import { relativeTime } from "@/lib/format";
import type { ErrorItem, ToolCallDetail } from "@/lib/errors";

type Detail = ToolCallDetail | "loading" | "error";

export function Incidents() {
  const { tick } = useLive();
  const { query } = useSearch();
  const { t, lang } = useT();
  const [recent, setRecent] = useState<ErrorItem[] | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [details, setDetails] = useState<Record<number, Detail>>({});

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch("/api/errors?limit=30")
        .then((r) => r.json())
        .then((d: { recent: ErrorItem[] }) => {
          if (!cancelled) setRecent(d.recent ?? []);
        })
        .catch(() => {});
    load();
    const poll = setInterval(load, 15_000);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, [tick]);

  const toggle = (id: number) => {
    const next = openId === id ? null : id;
    setOpenId(next);
    if (next !== null && details[id] === undefined) {
      setDetails((d) => ({ ...d, [id]: "loading" }));
      fetch(`/api/tool-calls/${id}`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d: { detail: ToolCallDetail }) => setDetails((prev) => ({ ...prev, [id]: d.detail })))
        .catch(() => setDetails((prev) => ({ ...prev, [id]: "error" })));
    }
  };

  const filtered = (recent ?? []).filter((e) =>
    matchesQuery(query, e.tool_name, e.target, e.error_text, e.session_id),
  );

  return (
    <Panel title={t("incidents.title")} icon={<AlertTriangle className="h-4 w-4 text-accent" />} info={t("incidents.info")}>
      {!recent ? (
        <WidgetState icon={AlertTriangle} title={t("common.loading")} loading />
      ) : recent.length === 0 ? (
        <WidgetState icon={AlertTriangle} title={t("incidents.empty")} />
      ) : filtered.length === 0 ? (
        <WidgetState icon={AlertTriangle} title={t("common.noResults")} />
      ) : (
        <ul className="divide-y divide-panel-border/60">
          {filtered.map((e) => {
            const open = openId === e.id;
            const detail = details[e.id];
            return (
              <li key={e.id} className="mc-stream-in">
                <button
                  onClick={() => toggle(e.id)}
                  aria-expanded={open}
                  className="flex w-full items-start gap-2 px-4 py-2 text-left transition-colors hover:bg-white/[0.03]"
                >
                  {open ? (
                    <ChevronDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" />
                  ) : (
                    <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" />
                  )}
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-sm text-foreground">{e.tool_name}</span>
                      {e.target && (
                        <span className="truncate font-mono text-[11px] text-muted" title={e.target}>
                          {e.target}
                        </span>
                      )}
                    </div>
                    {e.error_text && (
                      <p className={`truncate text-[11px] text-red-400/90 ${open ? "hidden" : ""}`}>{e.error_text}</p>
                    )}
                  </div>
                  <span className="shrink-0 whitespace-nowrap text-[11px] text-muted">
                    {relativeTime(e.created_at, lang)}
                  </span>
                </button>
                {open && (
                  <div className="px-4 pb-3 pl-9">
                    {detail === "loading" || detail === undefined ? (
                      <p className="text-[11px] text-muted">{t("common.loading")}</p>
                    ) : detail === "error" ? (
                      <p className="text-[11px] text-muted">{t("incidents.loadError")}</p>
                    ) : (
                      <ToolCallInspector detail={detail} />
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
