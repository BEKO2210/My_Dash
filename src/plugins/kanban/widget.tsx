"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { KanbanSquare, Coins, ExternalLink, Folder, Hammer, Radio, Server, X } from "lucide-react";
import { Panel } from "@/components/panel";
import { WidgetState } from "@/components/widget-state";
import { usePluginQuery } from "@/components/plugin-data";
import { useLive } from "@/components/live-provider";
import { useView, ViewSwitch } from "@/components/view-variant";
import { useSearch, matchesQuery } from "@/components/search";
import { useFacets } from "@/components/facets";
import { useT } from "@/lib/i18n";
import { sessionMatchesFacets } from "@/lib/facets";
import { formatCompact, relativeTime, STATUS_META } from "@/lib/format";
import { useMoney } from "@/components/currency";
import type { ViewOption } from "@/plugins/registry";
import type { EventRow, SessionRow, SessionStatus } from "@/lib/types";

type SessionCard = SessionRow & { event_count: number; tool_count: number; stale?: boolean };

const COLUMNS: SessionStatus[] = ["active", "waiting", "ended"];
const EMPTY_SESSIONS: SessionCard[] = [];

// Phase F (F3): board (default, today's look) ↔ list (flat, status-sorted rows).
const WIDGET_ID = "kanban";
const VIEW_VALUES = ["board", "list"] as const;
const STATUS_ORDER: Record<SessionStatus, number> = { active: 0, waiting: 1, ended: 2 };
export const KANBAN_VIEWS: ViewOption[] = [
  { value: "board", label: "view.board" },
  { value: "list", label: "view.list" },
];

export function Kanban() {
  const { events } = useLive();
  const { query } = useSearch();
  const facets = useFacets();
  const { t } = useT();
  const [selected, setSelected] = useState<SessionCard | null>(null);
  const view = useView(WIDGET_ID, VIEW_VALUES, "board");
  // 10s poll keeps relative times + ended state fresh.
  const q = usePluginQuery<{ sessions: SessionCard[] }>("/api/sessions", { pollMs: 10_000 });
  const sessions = q.data?.sessions ?? EMPTY_SESSIONS;

  const filtered = useMemo(
    () =>
      sessions
        .filter((s) => sessionMatchesFacets(s, facets))
        .filter((s) => matchesQuery(query, s.title, s.project_name, s.id)),
    [sessions, facets, query],
  );

  // Group once per change instead of filtering the list three times each render.
  const byStatus = useMemo(() => {
    const g: Record<SessionStatus, SessionCard[]> = { active: [], waiting: [], ended: [] };
    for (const s of filtered) g[s.status].push(s);
    return g;
  }, [filtered]);

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
      right={<ViewSwitch widgetId={WIDGET_ID} options={KANBAN_VIEWS} value={view} t={t} />}
    >
      {q.error && !q.data ? (
        <WidgetState icon={KanbanSquare} title={t("common.loadError")} onRetry={q.refetch} retryLabel={t("common.retry")} />
      ) : (
      <>
      {view === "list" ? (
        <SessionList sessions={filtered} query={query} onOpen={setSelected} />
      ) : (
      // On phones the 3 columns become a horizontal swipe with readable widths;
      // from sm up they're an even 3-column grid.
      <div className="flex h-full snap-x gap-px overflow-x-auto bg-panel-border/50 sm:grid sm:grid-cols-3 sm:overflow-x-hidden">
        {COLUMNS.map((status) => {
          const items = byStatus[status];
          const meta = STATUS_META[status];
          return (
            <div key={status} className="flex min-h-0 w-[78%] shrink-0 snap-start flex-col bg-panel sm:w-auto sm:shrink">
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
                  <p className="px-1 py-3 text-center text-[11px] text-muted">
                    {query.trim() ? t("common.noResults") : t("kanban.empty")}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
      )}
      {selectedLive && (
        <SessionDetail session={selectedLive} events={events} onClose={() => setSelected(null)} />
      )}
      </>
      )}
    </Panel>
  );
}

// List view: all filtered sessions as flat rows, sorted active→waiting→ended then
// most-recent. Same click-to-open-detail behaviour as the board cards.
function SessionList({
  sessions,
  query,
  onOpen,
}: {
  sessions: SessionCard[];
  query: string;
  onOpen: (s: SessionCard) => void;
}) {
  const { t, lang } = useT();
  const money = useMoney();
  if (sessions.length === 0) {
    return <WidgetState icon={KanbanSquare} title={query.trim() ? t("common.noResults") : t("kanban.empty")} />;
  }
  const sorted = [...sessions].sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.last_seen.localeCompare(a.last_seen),
  );
  return (
    <ul tabIndex={0} className="flex h-full flex-col gap-1 overflow-auto p-2 outline-none">
      {sorted.map((s) => {
        const meta = STATUS_META[s.status];
        const title = s.title || `${t("kanban.sessionFallback")} ${s.id.slice(0, 8)}`;
        return (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => onOpen(s)}
              aria-label={`${t("kanban.openDetail")}: ${title}`}
              className="flex w-full items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-left transition-colors hover:border-panel-border hover:bg-white/[0.03] focus-visible:border-accent focus-visible:outline-none"
            >
              <span className={`h-2 w-2 shrink-0 rounded-full ${meta.dot}`} title={t(`status.${s.status}`)} />
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">{title}</span>
              {s.project_name && (
                <span className="hidden shrink-0 items-center gap-1 font-mono text-[11px] text-muted sm:flex">
                  <Folder className="h-3 w-3" />
                  <span className="max-w-[8rem] truncate">{s.project_name}</span>
                </span>
              )}
              <span className="flex shrink-0 items-center gap-2 text-[11px] text-muted">
                <span className="flex items-center gap-1">
                  <Radio className="h-3 w-3" />
                  {s.event_count}
                </span>
                <span className="flex items-center gap-1">
                  <Hammer className="h-3 w-3" />
                  {s.tool_count}
                </span>
                {s.cost_usd > 0 && (
                  <span className="flex items-center gap-1">
                    <Coins className="h-3 w-3" />
                    {money(s.cost_usd)}
                  </span>
                )}
              </span>
              <span className="hidden shrink-0 whitespace-nowrap text-[11px] text-muted sm:inline">
                {relativeTime(s.last_seen, lang)}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function Card({ s, onOpen }: { s: SessionCard; onOpen: () => void }) {
  const { t, lang } = useT();
  const money = useMoney();
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
        {s.machine && (
          <span
            className="flex shrink-0 items-center gap-1 rounded bg-accent/10 px-1.5 text-[10px] text-accent"
            title={t("kanban.machine")}
          >
            <Server className="h-3 w-3" />
            <span className="max-w-[6rem] truncate">{s.machine}</span>
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
              {money(s.cost_usd)}
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

  // Render through a portal to <body>: the modal lives inside the Panel, whose
  // backdrop-filter establishes a containing block for position:fixed. Without the
  // portal, `fixed inset-0` would resolve against the small panel box (not the
  // viewport), so the overlay only covered the widget and the dialog spilled out.
  if (typeof document === "undefined") return null;

  return createPortal(
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
            <p className="py-2 text-[11px] text-muted">{t("kanban.noEvents")}</p>
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
    </div>,
    document.body,
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
