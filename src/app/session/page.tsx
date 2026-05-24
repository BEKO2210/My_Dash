"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  Bell,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  GitBranch,
  Layers,
  MessageSquare,
  Play,
  Square,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { WidgetState } from "@/components/widget-state";
import { DEMO, installDemoBackend } from "@/lib/demo";
import { useT } from "@/lib/i18n";
import {
  eventKind,
  formatCompact,
  formatDuration,
  formatMoney,
  KIND_COLOR,
  parseDbTime,
  relativeTime,
  STATUS_META,
  type EventKind,
} from "@/lib/format";
import type { SessionDetail } from "@/lib/session-detail";

if (DEMO) installDemoBackend();

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

export default function SessionPageRoute() {
  return (
    <Suspense fallback={null}>
      <SessionPage />
    </Suspense>
  );
}

function SessionPage() {
  const { t, lang } = useT();
  const id = useSearchParams().get("id") ?? "";
  const [data, setData] = useState<SessionDetail | null | "error">(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    fetch(`/api/sessions/${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: SessionDetail) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setData("error");
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const state = !id ? "error" : data;

  return (
    <div className="mx-auto flex min-h-screen max-w-[1100px] flex-col gap-4 p-4 sm:p-6">
      <nav className="flex items-center gap-1.5 text-xs text-muted">
        <Link href="/" className="inline-flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" />
          {t("session.back")}
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="truncate text-foreground">{t("session.title")}</span>
      </nav>

      {state === null ? (
        <div className="rounded-xl border border-panel-border bg-panel/80">
          <WidgetState icon={Activity} title={t("common.loading")} loading />
        </div>
      ) : state === "error" ? (
        <div className="rounded-xl border border-panel-border bg-panel/80 py-16">
          <WidgetState icon={Activity} title={t("session.notFound")} description={t("session.notFoundHint")} />
        </div>
      ) : (
        <SessionView data={state} lang={lang} t={t} />
      )}
    </div>
  );
}

function SessionView({
  data,
  lang,
  t,
}: {
  data: SessionDetail;
  lang: "de" | "en";
  t: (k: string) => string;
}) {
  const { session: s } = data;
  const meta = STATUS_META[s.status] ?? STATUS_META.ended;
  const start = parseDbTime(s.first_seen)?.getTime();
  const end = parseDbTime(s.last_seen)?.getTime();
  const duration = start && end && end > start ? formatDuration(end - start) : "—";
  const totalTokens = s.token_input + s.token_output + s.token_cache;
  const title = s.title || `${t("session.fallback")} ${s.id.slice(0, 8)}`;

  return (
    <>
      <header className="rounded-xl border border-panel-border bg-panel/80 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="min-w-0 text-lg font-semibold text-foreground">{title}</h1>
          <span className="flex items-center gap-1.5 text-xs">
            <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
            <span className={meta.text}>{t(`status.${s.status}`)}</span>
          </span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-muted">
          <span>{s.project_name ?? "—"}</span>
          <span aria-hidden>·</span>
          <span>{s.id}</span>
          {s.branch && (
            <>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1">
                <GitBranch className="h-3 w-3" />
                {s.branch}
              </span>
            </>
          )}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Metric label={t("session.duration")} value={duration} />
          <Metric label={t("session.events")} value={String(data.eventCount)} />
          <Metric label={t("session.tools")} value={String(data.toolCount)} />
          <Metric label={t("session.failures")} value={String(data.failureCount)} tone={data.failureCount > 0 ? "text-red-400" : undefined} />
          <Metric label={t("session.tokens")} value={formatCompact(totalTokens)} />
          <Metric label={t("session.cost")} value={formatMoney(s.cost_usd, "USD")} />
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title={t("session.timeline")} count={data.events.length}>
          {data.events.length === 0 ? (
            <Empty t={t} />
          ) : (
            <ul className="divide-y divide-panel-border/60">
              {data.events.map((e) => {
                const kind = eventKind(e.event_type);
                const Icon = ICONS[kind];
                return (
                  <li key={e.id} className="flex items-start gap-2.5 px-4 py-2">
                    <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${KIND_COLOR[kind]}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-foreground">{e.summary ?? e.event_type}</p>
                      <p className="truncate font-mono text-[11px] text-muted">{e.event_type}</p>
                    </div>
                    <span className="shrink-0 whitespace-nowrap text-[11px] text-muted">
                      {relativeTime(e.created_at, lang)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        <div className="flex flex-col gap-4">
          <Section title={t("session.prompts")} count={data.prompts.length}>
            {data.prompts.length === 0 ? (
              <Empty t={t} />
            ) : (
              <ul className="divide-y divide-panel-border/60">
                {data.prompts.map((p) => (
                  <li key={p.id} className="px-4 py-2">
                    <p className="whitespace-pre-wrap break-words text-sm text-foreground">{p.text}</p>
                    <p className="mt-1 text-[11px] text-muted">
                      {relativeTime(p.created_at, lang)}
                      {p.token_estimate > 0 ? ` · ~${formatCompact(p.token_estimate)} ${t("session.tokens")}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title={t("session.toolCalls")} count={data.tools.length}>
            {data.tools.length === 0 ? (
              <Empty t={t} />
            ) : (
              <ul className="divide-y divide-panel-border/60">
                {data.tools.map((tc) => (
                  <li key={tc.id} className="flex items-center gap-2 px-4 py-2 text-sm">
                    <Wrench className={`h-3.5 w-3.5 shrink-0 ${tc.success === 0 ? "text-red-400" : "text-emerald-400"}`} />
                    <span className="font-mono text-foreground">{tc.tool_name}</span>
                    {tc.target && (
                      <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted" title={tc.target}>
                        {tc.target}
                      </span>
                    )}
                    <span className="ml-auto shrink-0 whitespace-nowrap text-[11px] text-muted">
                      {relativeTime(tc.created_at, lang)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>
    </>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg bg-white/[0.03] px-3 py-2">
      <p className={`font-mono text-sm tabular-nums ${tone ?? "text-foreground"}`}>{value}</p>
      <p className="truncate text-[10px] uppercase tracking-wide text-muted">{label}</p>
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section className="flex max-h-[60vh] flex-col overflow-hidden rounded-xl border border-panel-border bg-panel/80">
      <header className="flex items-center justify-between border-b border-panel-border px-4 py-2.5 text-sm font-semibold text-foreground">
        <span>{title}</span>
        <span className="text-xs font-normal text-muted">{count}</span>
      </header>
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
    </section>
  );
}

function Empty({ t }: { t: (k: string) => string }) {
  return <p className="px-4 py-6 text-center text-xs text-muted">{t("session.none")}</p>;
}
