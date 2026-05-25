"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  Bell,
  CheckCircle2,
  CircleDot,
  Layers,
  MessageSquare,
  Play,
  Radio,
  Square,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { Panel } from "@/components/panel";
import { WidgetState } from "@/components/widget-state";
import { useLive } from "@/components/live-provider";
import { usePluginQuery } from "@/components/plugin-data";
import { viewState } from "@/components/widget-view";
import { useT } from "@/lib/i18n";
import {
  eventKind,
  formatCompact,
  formatDuration,
  KIND_COLOR,
  parseDbTime,
  relativeTime,
  STATUS_META,
  type EventKind,
} from "@/lib/format";
import { useMoney } from "@/components/currency";
import type { SessionRow } from "@/lib/types";

const ICONS: Record<EventKind, LucideIcon> = {
  "session-start": Play,
  "session-end": Square,
  prompt: MessageSquare,
  "tool-pre": Wrench,
  "tool-post": CheckCircle2,
  notification: Bell,
  stop: CircleDot,
  subagent: Users,
  compact: Layers,
  other: Activity,
};

type SessionCard = SessionRow & { event_count: number; tool_count: number };

export function LiveNow() {
  const { events, connected } = useLive();
  const { t, lang } = useT();
  const money = useMoney();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const q = usePluginQuery<{ sessions: SessionCard[] }>("/api/sessions");
  const sessions = q.data?.sessions ?? null;

  // Tick the elapsed clock once a second so the live timer stays accurate.
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // The "now" session: the one tied to the newest event if still live, else the
  // most recently active non-ended session.
  const live = (sessions ?? []).filter((s) => s.status !== "ended");
  const latestId = events[0]?.session_id;
  const active = live.find((s) => s.id === latestId) ?? live[0] ?? null;
  const vs = viewState(q, () => active == null);

  const feed = active
    ? events.filter((e) => e.session_id === active.id).slice(0, 6)
    : [];

  return (
    <Panel
      title={t("now.title")}
      icon={<Radio className="h-4 w-4 text-accent" />}
      info={t("now.info")}
      right={
        <span className="flex items-center gap-1.5 text-xs text-muted">
          <span
            className={`mc-live-dot h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-red-500"}`}
          />
          {connected ? t("stream.live") : t("header.disconnected")}
        </span>
      }
    >
      {vs === "error" ? (
        <WidgetState icon={Radio} title={t("common.loadError")} onRetry={q.refetch} retryLabel={t("common.retry")} />
      ) : vs === "loading" ? (
        <WidgetState icon={Radio} title={t("common.loading")} loading />
      ) : !active ? (
        <WidgetState icon={Radio} title={t("now.idle")} description={t("now.idleHint")} />
      ) : (
        <div className="flex h-full flex-col gap-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-foreground" title={active.title ?? undefined}>
                {active.title ?? active.project_name ?? active.id.slice(0, 8)}
              </p>
              <p className="truncate font-mono text-[11px] text-muted">
                {active.project_name ?? "—"} · {active.id.slice(0, 8)}
              </p>
            </div>
            <span className="relative flex shrink-0 items-center gap-1.5 text-xs">
              <span className="relative flex h-2.5 w-2.5 items-center justify-center">
                {active.status === "active" && (
                  <span
                    className={`mc-ping absolute inline-flex h-2.5 w-2.5 rounded-full ${STATUS_META[active.status].dot}`}
                  />
                )}
                <span className={`h-2 w-2 rounded-full ${STATUS_META[active.status].dot}`} />
              </span>
              <span className={STATUS_META[active.status].text}>
                {t(`status.${active.status}`)}
              </span>
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2 text-center">
            <Stat label={t("now.elapsed")} value={formatDuration(nowMs - (parseDbTime(active.first_seen)?.getTime() ?? nowMs))} accent />
            <Stat label={t("now.tools")} value={String(active.tool_count)} />
            <Stat label={t("now.events")} value={String(active.event_count)} />
            <Stat label={t("now.cost")} value={money(active.cost_usd)} />
          </div>

          <div className="min-h-0 flex-1">
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">
              {t("now.lastActions")}
            </p>
            {feed.length === 0 ? (
              <p className="text-xs text-muted">{t("now.noActions")}</p>
            ) : (
              <ul className="space-y-1.5">
                {feed.map((e) => {
                  const kind = eventKind(e.event_type);
                  const Icon = ICONS[kind];
                  return (
                    <li key={e.id} className="mc-stream-in flex items-center gap-2 text-sm">
                      <Icon className={`h-3.5 w-3.5 shrink-0 ${KIND_COLOR[kind]}`} />
                      <span className="min-w-0 flex-1 truncate text-foreground">
                        {e.summary ?? e.event_type}
                      </span>
                      <span className="shrink-0 whitespace-nowrap text-[11px] text-muted">
                        {relativeTime(e.created_at, lang)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <p className="text-[11px] text-muted">
            {t("now.totalTokens")}: {formatCompact(active.token_input + active.token_output + active.token_cache)}
          </p>
        </div>
      )}
    </Panel>
  );
}

function Stat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg bg-white/[0.03] px-2 py-1.5">
      <p className={`truncate font-mono text-sm tabular-nums ${accent ? "text-accent" : "text-foreground"}`}>
        {value}
      </p>
      <p className="truncate text-[10px] uppercase tracking-wide text-muted">{label}</p>
    </div>
  );
}
