"use client";

import { Boxes, Plug, Webhook } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { useT } from "@/lib/i18n";

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-panel-border bg-background/60 p-3 font-mono text-[11px] leading-relaxed text-foreground">
      {children}
    </pre>
  );
}

export default function DocsPage() {
  const { lang } = useT();
  const de = lang !== "en";
  const L = (deStr: string, enStr: string) => (de ? deStr : enStr);

  return (
    <PageShell active="/docs">
      <div className="mc-fade-up flex max-w-3xl flex-col gap-12">
        <header>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {L("Entwickler-Doku", "Developer docs")}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted sm:text-base">
            {L(
              "Wie du eigene Widgets (Plugins) baust und wie die API funktioniert. Es gilt eine Regel über allem: Daten fließen nur in eine Richtung.",
              "How to build your own widgets (plugins) and how the API works. One rule rules them all: data flows one way.",
            )}
          </p>
        </header>

        {/* Golden rule */}
        <section className="rounded-xl border border-accent/30 bg-accent/5 p-5">
          <h2 className="text-sm font-semibold text-foreground">{L("Die goldene Regel", "The golden rule")}</h2>
          <p className="mt-2 text-sm text-muted">
            {L(
              "Daten fließen ausschließlich in eine Richtung. /api/ingest ist der einzige Schreibpfad; jedes Widget und jede Read-Route ist read-only und schreibt nie in die DB.",
              "Data flows strictly one way. /api/ingest is the only write path; every widget and read route is read-only and never writes to the DB.",
            )}
          </p>
          <Code>{`Hooks → /api/ingest → SQLite → UI`}</Code>
        </section>

        {/* Plugins */}
        <section className="flex flex-col gap-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Boxes className="h-5 w-5 text-accent" />
            {L("Ein Widget (Plugin) erstellen", "Create a widget (plugin)")}
          </h2>
          <p className="text-sm text-muted">
            {L(
              "Das Dashboard ist ein Plugin-Grid. Jedes Widget lebt unter src/plugins/<id>/ und wird in src/plugins/registry.ts registriert. Drei Schritte:",
              "The dashboard is a plugin grid. Each widget lives under src/plugins/<id>/ and is registered in src/plugins/registry.ts. Three steps:",
            )}
          </p>

          <h3 className="text-sm font-semibold text-foreground">
            {L("1. Die Komponente", "1. The component")} — <code className="text-accent">src/plugins/my-widget/widget.tsx</code>
          </h3>
          <p className="text-sm text-muted">
            {L(
              "Eine React-Komponente, in <Panel> gewickelt. Lies Daten read-only über eine API-Route und aktualisiere bei jedem Live-Tick.",
              "A React component wrapped in <Panel>. Read data read-only from an API route and refresh on every live tick.",
            )}
          </p>
          <Code>{`"use client";
import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { Panel } from "@/components/panel";
import { WidgetState } from "@/components/widget-state";
import { useLive } from "@/components/live-provider";
import { useT } from "@/lib/i18n";

export function MyWidget() {
  const { t } = useT();
  const { tick } = useLive();            // re-fetch on each live event
  const [value, setValue] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/my-widget")
      .then((r) => r.json())
      .then((d) => setValue(d.value))
      .catch(() => {});
  }, [tick]);

  return (
    <Panel title={t("myWidget.title")} icon={<Sparkles className="h-4 w-4 text-accent" />} info={t("myWidget.info")}>
      {value === null ? <WidgetState title={t("common.loading")} loading /> : <div className="text-3xl font-mono">{value}</div>}
    </Panel>
  );
}`}</Code>

          <h3 className="text-sm font-semibold text-foreground">
            {L("2. (Optional) Eine Read-Route", "2. (Optional) a read route")} — <code className="text-accent">src/app/api/my-widget/route.ts</code>
          </h3>
          <p className="text-sm text-muted">
            {L(
              "Nur lesen — niemals schreiben. Bei fehlenden Daten leer zurückgeben (nie 5xx).",
              "Read only — never write. Degrade to empty on missing data (never 5xx).",
            )}
          </p>
          <Code>{`import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const db = getDb();
  const row = db.prepare("SELECT COUNT(*) AS value FROM events").get() as { value: number };
  return NextResponse.json({ value: row.value });
}`}</Code>

          <h3 className="text-sm font-semibold text-foreground">
            {L("3. Registrieren", "3. Register it")} — <code className="text-accent">src/plugins/registry.ts</code>
          </h3>
          <Code>{`{
  id: "my-widget",
  title: "My widget",
  span: "lg:col-span-3",      // width on the 6-col grid
  height: H,                  // shared height constant
  icon: Sparkles,
  category: "tools",          // overview | sessions | activity | tools | economy | quality
  description: "myWidget.info",
  // optional per-widget settings (rendered in the settings drawer,
  // persisted via /api/plugins/config):
  settings: [{ key: "limit", type: "number", label: "myWidget.limit", default: 50, min: 10, max: 300 }],
  component: MyWidget,
}`}</Code>

          <div className="rounded-lg border border-panel-border bg-panel/40 p-4 text-sm text-muted">
            <p className="font-semibold text-foreground">{L("Konventionen", "Conventions")}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>{L("Alle UI-Texte nach src/lib/i18n.tsx — immer DE und EN.", "All UI strings go in src/lib/i18n.tsx — always DE and EN.")}</li>
              <li>{L("Icon-only-Buttons brauchen aria-label; Dialoge schließen mit Esc.", "Icon-only buttons need aria-label; dialogs close on Esc.")}</li>
              <li>{L("Golden Rule einhalten: kein Widget schreibt jemals in die DB.", "Honour the golden rule: no widget ever writes to the DB.")}</li>
              <li>{L("lint, test und build müssen vor einem PR grün sein.", "lint, test and build must pass before a PR.")}</li>
            </ul>
          </div>

          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Plug className="h-4 w-4 text-accent" />
            {L("Drittanbieter-Plugins", "Third-party plugins")}
          </h3>
          <p className="text-sm text-muted">
            {L(
              "Externe Widgets kommen nach plugins.local/<name>/plugin.tsx und exportieren `export const plugin: Widget`. Sie werden beim Build automatisch gescannt und ins Grid gemischt — kein Eingriff in den Kerncode nötig.",
              "External widgets go into plugins.local/<name>/plugin.tsx and `export const plugin: Widget`. They are scanned automatically at build and merged into the grid — no core-code changes needed.",
            )}
          </p>
        </section>

        {/* API */}
        <section className="flex flex-col gap-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Webhook className="h-5 w-5 text-accent" />
            {L("Wie die API funktioniert", "How the API works")}
          </h2>

          <h3 className="text-sm font-semibold text-foreground">{L("Schreiben: /api/ingest (der einzige Schreibpfad)", "Write: /api/ingest (the only write path)")}</h3>
          <p className="text-sm text-muted">
            {L(
              "Wird ausschließlich von Claude-Code-Hooks gefüttert. POST mit Header X-Hook-Event und JSON-Body mit session_id. Der Server lauscht nur auf 127.0.0.1; optional erzwingt MC_HOOK_TOKEN ein geteiltes Geheimnis (Header X-Hook-Token).",
              "Fed exclusively by Claude Code hooks. POST with an X-Hook-Event header and a JSON body containing session_id. The server binds to 127.0.0.1 only; optionally MC_HOOK_TOKEN enforces a shared secret (X-Hook-Token header).",
            )}
          </p>
          <Code>{`curl -X POST http://127.0.0.1:3000/api/ingest \\
  -H "X-Hook-Event: PostToolUse" \\
  -H "Content-Type: application/json" \\
  -d '{"session_id":"abc","cwd":"/repo","tool_name":"Read","tool_input":{"file_path":"/x.ts"},"tool_response":{"ok":true}}'`}</Code>
          <p className="text-sm text-muted">
            {L(
              "Event-Typen: SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, Stop, SessionEnd, Notification, PreCompact. Unbekannte Felder werden toleriert; fehlt session_id, wird der Event ignoriert.",
              "Event types: SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, Stop, SessionEnd, Notification, PreCompact. Unknown fields are tolerated; without a session_id the event is ignored.",
            )}
          </p>

          <h3 className="text-sm font-semibold text-foreground">{L("Lesen: Read-Routes (read-only)", "Read: read routes (read-only)")}</h3>
          <p className="text-sm text-muted">
            {L(
              "Jedes Widget liest aus einer Route. Alle sind read-only und liefern bei fehlenden Daten leere Ergebnisse (nie 5xx). Eine Auswahl:",
              "Each widget reads from a route. All are read-only and return empty results on missing data (never 5xx). A selection:",
            )}
          </p>
          <Code>{`/api/health        /api/sessions      /api/events       /api/stats
/api/graph         /api/usage         /api/budget       /api/tools
/api/tools/latency /api/errors        /api/reliability  /api/files
/api/sankey        /api/tags          /api/token-burn   /api/mcp
/api/prompts       /api/subagents     /api/compactions  /api/streak
/api/velocity      /api/calendar      /api/anomaly      /api/git/branches
/api/session-duration                 /api/usage/projects /api/usage/sessions`}</Code>

          <h3 className="text-sm font-semibold text-foreground">{L("Live: SSE", "Live: SSE")}</h3>
          <p className="text-sm text-muted">
            {L(
              "/api/stream ist ein Server-Sent-Events-Strom. Der LiveProvider abonniert ihn; jeder Event erhöht einen tick, woraufhin Widgets neu laden — so wird das Dashboard in Echtzeit aktualisiert.",
              "/api/stream is a Server-Sent-Events stream. The LiveProvider subscribes to it; each event bumps a tick, which makes widgets re-fetch — that's how the dashboard updates in real time.",
            )}
          </p>

          <h3 className="text-sm font-semibold text-foreground">{L("Maschinen-lesbar", "Machine-readable")}</h3>
          <p className="text-sm text-muted">
            {L(
              "/api/openapi liefert die vollständige OpenAPI-3.1-Spezifikation, /api/metrics einen Prometheus-Scrape, /api/export CSV/JSON und /api/digest einen HTML-Report.",
              "/api/openapi serves the full OpenAPI 3.1 spec, /api/metrics a Prometheus scrape, /api/export CSV/JSON, and /api/digest an HTML report.",
            )}
          </p>
        </section>
      </div>
    </PageShell>
  );
}
