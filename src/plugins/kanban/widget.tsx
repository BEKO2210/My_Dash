"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { KanbanSquare, Coins, ExternalLink, Folder, Hammer, Radio, X } from "lucide-react";
import { Panel } from "@/components/panel";
import { useLive } from "@/components/live-provider";
import { useSearch, matchesQuery } from "@/components/search";
import { useFacets } from "@/components/facets";
import { useT } from "@/lib/i18n";
import { sessionMatchesFacets } from "@/lib/facets";
import { formatCompact, formatMoney, relativeTime, STATUS_META } from "@/lib/format";
import type { EventRow, SessionRow, SessionStatus } from "@/lib/types";

type SessionCard = SessionRow & { event_count: number; tool_count: number; stale?: boolean };

const COLUMNS: SessionStatus[] = ["active", "waiting", "ended"];

export function Kanban() {
  const { tick, events } = useLive();
  const { query } = useSearch();
  const facets = useFacets();
  const { t } = useT();
  const [sessions, setSessions] = useState<SessionCard[]>([]);
  const [selected, setSelected] = useState<SessionCard | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch("/api/sessions")
        .then((r) => r.json())
        .then((d: { sessions: SessionCard[] }) => {
          if (!cancelled) setSessions(d.sessions);
        })
        .catch(() => {});
    load();
    const poll = setInterval(load, 10_000); // keeps relative times + ended state fresh
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, [tick]);

  const filtered = useMemo(
    () =>
      sessions
        .filter((s) => sessionMatchesFacets(s, facets))
        .filter((s) => matchesQuery(query, s.title, s.project_name, s.id)),
    [sessions, facets, query],
  );

  // Keep the open detail in sync with refreshed data; close it if the session is gone.
  const selectedLive = useMemo(
    () => (selected ? sessions.find((s) => s.id === selected.id) ?? null : null),
    [selected, sessions],
  );

  return (
    <Panel
      title={t("kanban.title")}
      icon={<KanbanSquare className="h-4 w-4 text-accent" />}
      info={t("kanban.info")}
    >
      <div className="grid h-full grid-cols-3 gap-px bg-panel-border/50">
        {COLUMNS.map((status) => {
          const items = filtered.filter((s) => s.status === status);
          const meta = STATUS_META[status];
          return (
            <div key={status} className="flex min-h-0 flex-col bg-panel">
              <div className="flex items-center justify-between px-3 py-2">
                <span className={`flex items-center gap-1.5 text-xs font-semibold ${meta.text}`}>
                  <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                  {t(`status.${status}`)}
                </span>
                <span className="rounded-full bg-background/60 px-1.5 py-0.5 text-[11px] tabular-nums text-muted">
                  {items.length}
                </span>
              </div>
              <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto px-2 pb-2">
                {items.map((s) => (
                  <Card key={s.id} s={s} onOpen={() => setSelected(s)} />
                ))}
                {items.length === 0 && (
                  <p className="px-1 py-3 text-center text-[11px] text-muted/60">
                    {query.trim() ? t("common.noResults") : t("kanban.empty")}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {selectedLive && (
        <SessionDetail session={selectedLive} events={events} onClose={() => setSelected(null)} />
      )}
    </Panel>
  );
}

function Card({ s, onOpen }: { s: SessionCard; onOpen: () => void }) {
  const { t, lang } = useT();
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${t("kanban.openDetail")}: ${s.title || `${t("kanban.sessionFallback")} ${s.id.slice(0, 8)}`}`}
      className="mc-fade-in w-full rounded-lg border border-panel-border bg-background/60 p-2.5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-md hover:shadow-black/20 focus-visible:border-accent focus-visible:outline-none"
    >
      <p className="line-clamp-2 text-sm text-foreground">
        {s.title || `${t("kanban.sessionFallback")} ${s.id.slice(0, 8)}`}
      </p>
      {s.stale && (
        <span className="mt-1 inline-block rounded bg-zinc-500/15 px-1.5 py-0.5 text-[10px] text-zinc-400">
          {t("kanban.stale")}
        </span>
      )}
      <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted">
        {s.project_name && (
          <span className="flex items-center gap-1 truncate">
            <Folder className="h-3 w-3 shrink-0" />
            <span className="truncate">{s.project_name}</span>
          </span>
        )}
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted">
        <span className="flex items-center gap-2">
          <span className="flex items-center gap-1">
            <Radio className="h-3 w-3" />
            {s.event_count}
          </span>
          <span className="flex items-center gap-1">
            <Hammer className="h-3 w-3" />
            {s.tool_count}
          </span>
          {s.cost_usd > 0 && (
            <span
              className="flex items-center gap-1"
              title={`${formatCompact(s.token_input + s.token_output + s.token_cache)} tok`}
            >
              <Coins className="h-3 w-3" />
              {formatMoney(s.cost_usd, "USD")}
            </span>
          )}
        </span>
        <span>{relativeTime(s.last_seen, lang)}</span>
      </div>
    </button>
  );
}

function SessionDetail({
  session,
  events,
  onClose,
}: {
  session: SessionCard;
  events: EventRow[];
  onClose: () => void;
}) {
  const { t, lang } = useT();
  const meta = STATUS_META[session.status];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const recent = useMemo(
    () => events.filter((e) => e.session_id === session.id).slice(0, 12),
    [events, session.id],
  );

  const title = session.title || `${t("kanban.sessionFallback")} ${session.id.slice(0, 8)}`;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("kanban.detail")}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-panel-border bg-panel shadow-2xl shadow-black/50"
      >
        <header className="flex items-start justify-between gap-3 border-b border-panel-border px-4 py-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-muted">{t("kanban.detail")}</p>
            <h2 className="mt-0.5 break-words text-sm font-semibold text-foreground">{title}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href={`/session?id=${encodeURIComponent(session.id)}`}
              aria-label={t("kanban.openPage")}
              title={t("kanban.openPage")}
              className="text-muted transition-colors hover:text-foreground"
            >
              <ExternalLink className="h-4 w-4" />
            </Link>
            <button
              type="button"
              onClick={onClose}
              aria-label={t("common.close")}
              title={t("common.close")}
              className="text-muted transition-colors hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-auto px-4 py-3 text-xs">
          <dl className="space-y-1.5 text-muted">
            <Row k={t("graph.status")} v={<span className={meta.text}>{t(`status.${session.status}`)}</span>} />
            {session.project_name && <Row k={t("graph.project")} v={session.project_name} />}
            <Row k={t("graph.id")} v={<span className="font-mono">{session.id.slice(0, 16)}</span>} />
            <Row k={t("kanban.firstSeen")} v={relativeTime(session.first_seen, lang)} />
            <Row k={t("kanban.lastSeen")} v={relativeTime(session.last_seen, lang)} />
            <Row k={t("kanban.eventsLabel")} v={String(session.event_count)} />
            <Row k={t("kanban.toolsLabel")} v={String(session.tool_count)} />
          </dl>

          <p className="mb-1.5 mt-3 text-[11px] font-semibold uppercase tracking-wide text-muted">
            {t("kanban.recentEvents")}
          </p>
          {recent.length === 0 ? (
            <p className="py-2 text-[11px] text-muted/70">{t("kanban.noEvents")}</p>
          ) : (
            <ul className="divide-y divide-panel-border/60">
              {recent.map((e) => (
                <li key={e.id} className="flex items-start justify-between gap-2 py-1.5">
                  <div className="min-w-0">
                    <p className="truncate text-foreground">{e.summary ?? e.event_type}</p>
                    <p className="truncate font-mono text-[10px] text-muted">{e.event_type}</p>
                  </div>
                  <span className="shrink-0 whitespace-nowrap text-[10px] text-muted">
                    {relativeTime(e.created_at, lang)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="shrink-0">{k}</dt>
      <dd className="text-right text-foreground">{v}</dd>
    </div>
  );
}
