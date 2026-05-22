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
import { useLive } from "@/components/live-provider";
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
  const [, setNow] = useState(0);

  // Re-render periodically so relative timestamps stay fresh.
  useEffect(() => {
    const t = setInterval(() => setNow((n) => n + 1), 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <Panel
      title="Live Stream"
      icon={<Activity className="h-4 w-4 text-accent" />}
      info="Live-Strom aller Hook-Events in Echtzeit (neueste oben): Session-Start/-Ende, Prompts, Tool-Aufrufe und Stops. Speist sich per SSE aus den Claude-Code-Hooks."
      right={
        <span className="flex items-center gap-1.5 text-xs text-muted">
          <span
            className={`mc-live-dot h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-red-500"}`}
          />
          {connected ? "live" : "getrennt"}
        </span>
      }
    >
      {events.length === 0 ? (
        <Empty />
      ) : (
        <ul className="divide-y divide-panel-border/60">
          {events.map((e) => {
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
                  {relativeTime(e.created_at)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

function Empty() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted">
      <Activity className="h-6 w-6 opacity-50" />
      <p>Noch keine Events.</p>
      <p className="text-xs">
        Starte eine Claude-Code-Session oder führe <code className="text-accent">npm run seed</code> aus.
      </p>
    </div>
  );
}
