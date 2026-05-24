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
  Square,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { Panel } from "@/components/panel";
import { WidgetState } from "@/components/widget-state";
import { useLive } from "@/components/live-provider";
import { useSearch, matchesQuery } from "@/components/search";
import { usePluginConfig } from "@/components/plugin-config";
import { useT } from "@/lib/i18n";
import { eventKind, KIND_COLOR, relativeTime, type EventKind } from "@/lib/format";

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

export function LiveStream() {
  const { events, connected } = useLive();
  const { query } = useSearch();
  const { t, lang } = useT();
  const { values } = usePluginConfig("live-stream");
  const [, setNow] = useState(0);

  // Re-render periodically so relative timestamps stay fresh.
  useEffect(() => {
    const t = setInterval(() => setNow((n) => n + 1), 5000);
    return () => clearInterval(t);
  }, []);

  const limit = typeof values.limit === "number" ? values.limit : 100;

  const filtered = events
    .filter((e) => matchesQuery(query, e.summary, e.event_type, e.tool_name, e.session_id))
    .slice(0, limit);

  return (
    <Panel
      title={t("stream.title")}
      icon={<Activity className="h-4 w-4 text-accent" />}
      info={t("stream.info")}
      right={
        <span className="flex items-center gap-1.5 text-xs text-muted">
          <span
            className={`mc-live-dot h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-red-500"}`}
          />
          {connected ? t("stream.live") : t("header.disconnected")}
        </span>
      }
    >
      {events.length === 0 ? (
        <WidgetState
          icon={Activity}
          title={t("stream.emptyTitle")}
          description={
            <>
              {t("stream.emptyPre")}
              <code className="text-accent">npm run seed</code>
              {t("stream.emptyPost")}
            </>
          }
        />
      ) : filtered.length === 0 ? (
        <WidgetState icon={Activity} title={t("common.noResults")} />
      ) : (
        <ul role="log" aria-live="polite" aria-label={t("stream.title")} className="divide-y divide-panel-border/60">
          {filtered.map((e) => {
            const kind = eventKind(e.event_type);
            const Icon = ICONS[kind];
            return (
              <li
                key={e.id}
                className="mc-stream-in flex items-start gap-2.5 px-4 py-2 transition-colors hover:bg-white/[0.03]"
              >
                <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${KIND_COLOR[kind]}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground">{e.summary ?? e.event_type}</p>
                  <p className="truncate font-mono text-[11px] text-muted">
                    {e.event_type} · {e.session_id.slice(0, 8)}
                  </p>
                </div>
                <span className="shrink-0 whitespace-nowrap text-[11px] text-muted">
                  {relativeTime(e.created_at, lang)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
