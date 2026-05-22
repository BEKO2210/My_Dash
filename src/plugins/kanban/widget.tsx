"use client";

import { useEffect, useMemo, useState } from "react";
import { KanbanSquare, Folder, Hammer, Radio } from "lucide-react";
import { Panel } from "@/components/panel";
import { useLive } from "@/components/live-provider";
import { useLock } from "@/components/lock-provider";
import { relativeTime, STATUS_META } from "@/lib/format";
import type { SessionRow, SessionStatus } from "@/lib/types";

type SessionCard = SessionRow & { event_count: number; tool_count: number; stale?: boolean };

const COLUMNS: SessionStatus[] = ["active", "waiting", "ended"];

export function Kanban() {
  const { tick } = useLive();
  const { locked } = useLock();
  const [sessions, setSessions] = useState<SessionCard[]>([]);
  const [project, setProject] = useState<string>("all");

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

  const projects = useMemo(() => {
    const set = new Set<string>();
    for (const s of sessions) if (s.project_name) set.add(s.project_name);
    return [...set].sort();
  }, [sessions]);

  const filtered = useMemo(
    () => (project === "all" ? sessions : sessions.filter((s) => s.project_name === project)),
    [sessions, project],
  );

  return (
    <Panel
      title="Sessions"
      icon={<KanbanSquare className="h-4 w-4 text-accent" />}
      right={
        <select
          value={project}
          onChange={(e) => setProject(e.target.value)}
          disabled={locked}
          title={locked ? "Gesperrt — zum Ändern oben entsperren" : undefined}
          className="rounded-md border border-panel-border bg-background px-2 py-1 text-xs text-foreground outline-none focus:border-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="all">Alle Projekte</option>
          {projects.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      }
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
                  {meta.label}
                </span>
                <span className="text-xs text-muted">{items.length}</span>
              </div>
              <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto px-2 pb-2">
                {items.map((s) => (
                  <Card key={s.id} s={s} />
                ))}
                {items.length === 0 && (
                  <p className="px-1 py-3 text-center text-[11px] text-muted/60">leer</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function Card({ s }: { s: SessionCard }) {
  return (
    <div className="rounded-lg border border-panel-border bg-background/60 p-2.5 transition-colors hover:border-accent/50">
      <p className="line-clamp-2 text-sm text-foreground">
        {s.title || `Session ${s.id.slice(0, 8)}`}
      </p>
      {s.stale && (
        <span className="mt-1 inline-block rounded bg-zinc-500/15 px-1.5 py-0.5 text-[10px] text-zinc-400">
          inaktiv — automatisch beendet
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
        </span>
        <span>{relativeTime(s.last_seen)}</span>
      </div>
    </div>
  );
}
