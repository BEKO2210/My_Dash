# Claude Mission Control — Roadmap (100 Runs)

> Weiterentwicklung, nicht Neubau. Das Dashboard funktioniert heute — es bleibt
> funktionsfähig. Diese Roadmap **härtet** das Bestehende und **erweitert** es
> Schritt für Schritt zum besten Observability-Tool für Claude Code, das es gibt.

---

## Die goldene Regel (unverhandelbar)

Die Kern-Ideologie bleibt in **jedem** Run erhalten:

> **Daten fließen nur in eine Richtung:** `Hooks → /api/ingest → SQLite → UI`.
> Das LLM **rendert dieses Dashboard nie** — es löst nur Events aus. Der einzige
> Schreibpfad ist `/api/ingest`, gefüttert ausschließlich von Claude-Code-Hooks
> (Maschinen-Events).

Daraus abgeleitete Prinzipien, die kein Run verletzen darf:

- **Read-only & local-first** — alles bindet an `127.0.0.1`, nichts verlässt die
  Maschine ohne ausdrückliche Opt-in-Konfiguration.
- **Fire-and-forget** — der Hook-Forwarder (`scripts/claude-hook.sh`,
  `wire-hooks.mjs`) darf Claude Code **nie** blockieren oder verlangsamen.
- **Plugin-first** — neue Panels kommen über `src/plugins/registry.ts` dazu,
  nicht durch Umbau der Shell.
- **Degradiert sauf null** — fehlt eine Datenquelle (ccusage offline, leere DB),
  zeigt das Widget einen sauberen Leerzustand, kein Crash.

---

## Bestandsaufnahme (was heute existiert)

| Bereich | Datei(en) | Stand |
|---|---|---|
| Schreibpfad | `src/app/api/ingest/route.ts`, `src/lib/ingest.ts` | stabil; Projektion auf 9 Hook-Events |
| Datenbank | `src/lib/db.ts` | 3 Tabellen: `sessions`, `events`, `tool_calls`; Inline-Schema, **kein Migrationssystem** |
| Lesepfade | `/api/sessions`, `/api/events`, `/api/graph`, `/api/usage`, `/api/stream` (SSE) | funktionsfähig |
| Widgets | `src/plugins/{kanban,live-stream,token-chart,tool-graph}` + `registry.ts` | 4 Panels, Drag-Reorder |
| Kosten | `src/lib/ccusage.ts` | nutzt nur `daily` + `blocks` |
| Live | `src/components/live-provider.tsx`, `src/lib/bus.ts` | SSE mit Reconnect/Backoff |
| Mehrsprachig | `src/lib/i18n.tsx` | de/en |
| Demo | `src/lib/demo.ts` | In-Browser-Engine für GitHub Pages |
| Desktop | `electron/main.js` | Tray, Autostart, Server-Spawn |
| Backfill | `scripts/import-history.mjs` | liest `~/.claude/projects/**/*.jsonl` |
| Tests/CI | `src/lib/format.test.ts`, `.github/workflows/{pages,release}.yml` | **nur 1 Testdatei, keine Test/Lint-CI** |

**Ungenutztes Potenzial** (aus Online-Recherche): Claude Code bietet inzwischen
~21 Hook-Events (9 verdrahtet), vollständigen **OpenTelemetry/OTLP-Export**
(Tokens, Kosten, Tool-Latenz, Fehler, Degradation), **Pro-Nachricht-Token+Modell**
im `transcript_path`-JSONL und ccusage liefert **Pro-Session / Pro-Modell /
Monats- / Burn-Rate**-Daten, die wir noch nicht anfassen.

---

## Wie diese Roadmap funktioniert

- **100 Runs.** Ein Run = ein Prompt = ein eigenständiger, PR-großer Arbeitsschritt
  mit sichtbarem Mehrwert. Keine Mikro-Tasks.
- **Verkettet.** Jeder Run baut auf dem Ergebnis des vorherigen auf und bereitet
  den nächsten vor (`→` zeigt die Übergabe). Man arbeitet die Liste der Reihe
  nach ab; das Ergebnis von Run N sagt Run N+1, worauf er aufsetzt.
- **Großbaustellen (⚙️).** So markierte Runs sind absichtlich groß und dürfen
  sich bei der Umsetzung in eine Unterreihe von 5–20 kleineren Schritten
  auffächern. Die 100 bleiben die „Schlagzeilen".
- **Phasen.** Erst Fundament härten, dann Daten-Tiefe, dann Sichtbarmachung,
  dann Plattform, dann Release. Reihenfolge = Risiko-Reduktion.

### Definition of Done (für jeden Run)

Ein Run gilt erst als fertig, wenn:
`npm run lint` ✓ · `npm test` ✓ · `npm run build` ✓ · neue Logik hat Tests ·
neue UI hat i18n + Leer-/Fehler-/Ladezustand · die goldene Regel ist intakt ·
README/Docs sind nachgezogen.

---

## Phase A — Fundament härten (Runs 1–14)

> Bevor wir bauen, machen wir das Vorhandene kugelsicher. Ohne CI und Tests ist
> jeder spätere Run ein Blindflug.

1. **CI-Pipeline.** Neuer Workflow `ci.yml`: `npm ci → lint → test → build` bei
   jedem Push/PR. *Ergebnis:* grünes Gate für alle folgenden Runs. → liefert das
   Sicherheitsnetz für Run 2 ff.
2. **Test-Harness für die Ingest-Schicht.** In-Memory-SQLite-Fixture; Tests für
   `ingest()`: Status-Projektion (`Stop`=waiting, `SessionEnd`=ended), Titel-Set,
   Tool-Call-Pairing/Dauer. → ab jetzt ist die Projektion verlässlich.
3. **Graph-Builder testbar machen.** Reine Helfer (`describeTarget`,
   `programName`, `buildGraph`) aus `api/graph/route.ts` nach `src/lib/graph.ts`
   ziehen + Unit-Tests (Datei/Command/URL/Pattern, Node-Dedup).
4. **ccusage-Parser testbar machen.** Parsing aus `getUsage()` in reine Funktion
   extrahieren, mit Fixture-JSON testen (daily+blocks, EUR-Umrechnung, Leerfall).
5. **Payload-Validierung (Zod).** `HookPayloadSchema` definieren und in
   `/api/ingest` tolerant validieren (unbekannte Felder ok, Typen geprüft).
   *Ergebnis:* gehärteter einziger Schreibpfad.
6. ⚙️ **Versioniertes Migrationssystem.** Inline-`IF NOT EXISTS`-Schema in
   `db.ts` durch Migrations-Runner (`PRAGMA user_version`) ersetzen. *Ergebnis:*
   spätere Spalten/Tabellen sind sicher & geordnet. → **Voraussetzung für die
   gesamte Phase B.**
7. **Health-Endpoint.** `GET /api/health` (DB ok, Event-Count, Uptime, Version).
   → Electrons `waitForServer` und späteres Monitoring nutzen ihn.
8. **Strukturiertes Logging.** `src/lib/log.ts` mit Levels, ersetzt `console.*`
   in den Routes; optionales Datei-Log per Env.
9. **Ingest-Robustheit & Retention.** Tabellen-Wachstum begrenzen (konfigurierbar),
   Bus-Publish kapseln, damit ein langsamer Subscriber Ingest nicht stallt.
10. **SSE-Härtung.** `Last-Event-ID`-Resume in `/api/stream` + `/api/events`,
    damit Reconnects nie Events verlieren; Verbindungslimit.
11. **Einheitliche Zustände.** Geteilte `<WidgetState>`-Komponente für
    Leer/Fehler/Laden; in allen 4 Widgets ausrollen.
12. **Playwright-Smoke-E2E.** Geseedete App booten, alle 4 Widgets + SSE +
    Kanban prüfen; in CI einhängen.
13. **Backup/Restore härten.** `scripts/backup.mjs` auf SQLite-Online-Backup-API
    umstellen, `restore`-Gegenstück + Retention + Doku.
14. **Lokaler Security-Pass.** 127.0.0.1-Binding überall verifizieren,
    Security-Header, `MC_HOOK_TOKEN` dokumentieren. *Ergebnis:* getestetes,
    gehärtetes Fundament — bereit zum Ausbauen.

## Phase B — Mehr auslesen: Daten-Tiefe (Runs 15–28)

> Jetzt, wo Migrationen sicher sind, holen wir viel mehr aus dem, was Claude Code
> ohnehin sendet — sauber persistiert.

15. **Event-Detail-Lesepfad.** `GET /api/events/:id` liefert das voll geparste
    `payload_json`. → Fundament für alle Detail-Ansichten (Phase E).
16. ⚙️ **Tool-I/O strukturiert ablegen.** Tabelle `tool_io` (input_json,
    output_json, is_error, error_text), in `ingest.ts` aus `tool_input`/
    `tool_response` befüllt. → speist Tool-Inspector & Fehler-Panels.
17. **Modell pro Event.** `model` aus Payload/Transcript erfassen, Spalte zu
    `events` (Migration).
18. ⚙️ **Transcript-Tailing bei Stop.** Bei `Stop`/`SessionEnd` das Ende von
    `transcript_path` lesen → Pro-Turn-Tokens + Modell + Assistant-Text.
    *Ergebnis:* echte Pro-Session-Tokens auch ohne ccusage.
19. **Pro-Session Tokens/Kosten.** Getailte Nutzung in `sessions`
    (`token_input/output/cache`, `cost_usd`) aggregieren. → Kanban kann Kosten zeigen.
20. **MCP-Tool-Erkennung.** `mcp__server__tool` in Server+Tool zerlegen,
    `tool_calls` mit `source='mcp'` + `mcp_server` taggen.
21. ⚙️ **Subagent-Hierarchie.** `Task`-Calls mit Subagent-Sessions verknüpfen
    (`SubagentStop`); Eltern/Kind in `session_links`. → speist Subagent-Baum.
22. **Kompaktierungs-Tracking.** `PreCompact` mit Trigger + (falls verfügbar)
    Kontextgröße vorher/nachher festhalten.
23. **Fehler & Abbrüche.** Tool-Fehler, verweigerte Permissions, `StopFailure`
    erkennen + `error`-Flag. → speist Fehlerraten-Widget.
24. **Prompt-Volltext + Schätzung.** Vollen Prompt (gekappt) + Token-Schätzung je
    `UserPromptSubmit` speichern; Secret-Redaction-Filter (konfigurierbar).
25. **Datei-Diffs aus Edit/Write.** Aus `tool_input` Pfad + Änderungsgröße
    (±Zeilen) ableiten → für Datei-Hotspot-Analytik.
26. **Git-Kontext.** Bei `SessionStart` Branch/Commit erfassen (read-only
    git-Call im Hook bzw. aus Transcript); `branch` zu `sessions`.
27. ⚙️ **Aggregat-Tabelle.** `activity_buckets` (Stunden-Granularität, Counts je
    Session/Tool/Typ) im Ingest mitschreiben → schnelle Heatmaps/Charts.
28. **Backfill erweitern.** `import-history.mjs` füllt alle neuen Felder/Tabellen
    (Modell, Tokens, MCP, Fehler, Git). *Ergebnis:* Historie so reich wie Live.

## Phase C — Ökonomie & ccusage-Tiefe (Runs 29–37)

29. **ccusage Session-Report.** `session --json` einbinden → Pro-Session
    Kosten/Modell; `/api/usage/sessions`.
30. **Pro-Modell-Aufschlüsselung.** `--breakdown` parsen; `/api/usage` liefert
    Modell-Splits. → speist Modell-Donut.
31. **Monatsansicht.** `monthly --json`; „Monat"-Range im Token-Chart.
32. **Burn-Rate & Projektion.** Block-`burnRate`, `projectedCost`,
    `timeRemaining` durchreichen.
33. **Budget-Konfiguration.** Config-Tabelle + `.env` für Tages-/Monatsbudget;
    %-Auslastung berechnen.
34. **Budget-Gauge-Widget.** Heutige Ausgaben vs. Budget + Tages-/Monatsprognose.
35. **Kosten auf Kanban-Karten.** €/Tokens je Karte (aus Run 19/29).
36. **Kosten pro Projekt.** Aggregation nach `project_name`; `/api/usage/projects`.
    → speist Projekt-Leaderboard.
37. **Kosten-Reconciliation.** Transcript-Tokens vs. ccusage abgleichen,
    Diskrepanz anzeigen, ccusage bevorzugen. *Ergebnis:* vertrauenswürdige Ökonomie.

## Phase D — Neue Visualisierungen / Widgets (Runs 38–62)

> Jedes ist ein Plugin über die Registry — komplett mit API-Route, i18n,
> Leer-/Fehlerzustand und Test. Hier wird das Tool sichtbar „das beste".

38. **KPI-Statusleiste.** Stat-Karten-Reihe (aktive Sessions, Events heute,
    Kosten heute, Tool-Calls, Fehlerrate) mit Sparklines.
39. **Aktivitäts-Heatmap.** GitHub-Style Stunde×Wochentag (aus `activity_buckets`).
40. **Tool-Häufigkeit.** Treemap/Bar der meistgenutzten Tools über einen Zeitraum.
41. **Datei-Hotspots.** Treemap der meistberührten Dateien (aus Run 25).
42. **Session-Timeline (Gantt).** Horizontale Zeitleiste mit Status-Bändern.
43. **Tool-Latenz-Histogramm.** Verteilung von `duration_ms` je Tool; p50/p95.
44. **Fehlerraten-Panel.** Fehler-Count + Rate über Zeit, Top-Fehlertools.
45. **Modell-Nutzung (Donut).** Token-/Kostenanteil je Modell (aus Run 30).
46. **Sankey: Session → Tool → Datei.** Fluss-Diagramm als Ergänzung zum 3D-Graph.
47. **Projekt-Leaderboard.** Sessions/Kosten/Tools je Projekt, sortierbar.
48. **Live-„Jetzt"-Panel.** Aktive Session: Live-Tool-Feed, verstrichene Zeit,
    letzte Aktion.
49. **Prompt-Verlauf.** Chronologische, durchsuchbare Liste deiner Prompts.
50. **Streak/Produktivität.** Tages-Streak, Stoßzeiten, Sessions/Tag-Trend.
51. **Subagent-Baum.** Baum aus `Task` → Subagent-Sessions (aus Run 21).
52. **MCP-Server-Panel.** Aktivität je MCP-Server (aus Run 20).
53. **Kompaktierungs-Timeline.** Wann/wie oft Kontext komprimiert wurde (Run 22).
54. **Themen/Tag-Cloud.** Häufige Begriffe aus Prompts — lokal, ohne LLM.
55. **Tokens pro Tool/Phase.** Wo die meisten Tokens verbrennen (aus Transcript).
56. **Kalender-Heatmap (Jahr).** Jahresansicht von Aktivität/Kosten.
57. **Geschwindigkeits-Trend.** Tools/min, Events/Session über Zeit
    (Degradations-Signal).
58. **Session-Dauer-Verteilung.** Histogramm der Session-Längen.
59. **Erfolgs-/Fehlerquote je Projekt.** Zuverlässigkeit pro Projekt.
60. **„Was lief schief"-Panel.** Letzte Fehler mit Ein-Klick-Drill-down.
61. **Anpassbare Widget-Größe.** Pro-Widget span/height, persistiert (erweitert
    das Drag-Reorder).
62. **Widget-Galerie.** In-App-Picker zum Hinzufügen/Entfernen/Aktivieren von
    Widgets aus der Registry. *Ergebnis:* das Dashboard ist komponierbar.

## Phase E — Drill-down & Detail-UX (Runs 63–72)

63. ⚙️ **Session-Detailseite.** Volle Route `/session/[id]` (statt nur Dialog):
    Header-Stats, Event-Timeline, Tools, Kosten, Transcript-Link.
64. **JSON-Tree-Viewer.** Klappbarer Payload-Viewer (aus Run 15).
65. **Tool-Call-Inspector.** Input vs. Output nebeneinander; Diff für Edit/Write
    (aus Run 16/25).
66. ⚙️ **Transcript-Viewer.** Konversation read-only rendern (Nachrichten,
    Thinking, Tool-Use).
67. **Globaler Zeitbereich-Filter.** Gemeinsamer Datums-Range, den jedes Widget
    respektiert (Context + Query-Param).
68. **Facetten-Filter.** Filter nach Projekt/Modell/Tool/Status dashboard-weit.
69. **Volltextsuche (FTS5).** SQLite-FTS5 über Event-Summaries/Prompts; Header-
    Suche aufwerten.
70. **Gespeicherte Ansichten.** Benannte Filter+Layout-Kombis sichern.
71. **Deep-Links.** Jeder gefilterte/gezoomte Zustand ist URL-adressierbar (lokal).
72. **Command-Palette (⌘K).** Sprung zu Sessions/Widgets/Filtern; Tastatur-Nav.
    *Ergebnis:* Power-User-Navigation.

## Phase F — Plugin-Plattform reifen (Runs 73–80)

73. **Plugin-Manifest.** `Widget` um Metadaten erweitern (Beschreibung, Icon,
    Kategorie, Default-Größe, Settings-Schema).
74. **Plugin-Settings-Persistenz.** `plugin_config`-Tabelle +
    `/api/plugins/config`; Settings-Drawer pro Widget.
75. **Typed Plugin-Data-API.** Helfer-Hooks (`usePluginQuery`, `useLiveTick`) +
    read-only Query-Helfer, damit Plugins kein Fetch-Boilerplate brauchen.
76. **Externe Plugins.** `plugins.local/`-Verzeichnis beim Build scannen + Doku
    für Drittanbieter-Widgets.
77. **Theme-/Design-System.** Token-basiertes Theming (CSS-Vars),
    Hell/Dunkel/Custom, persistiert.
78. **Referenz-Plugin.** Beispiel-Drittanbieter-Plugin in eigenem Ordner +
    Authoring-Guide, beweist die Naht.
79. **Plugin-Isolierung & Telemetrie.** Pro-Plugin-Ladezeit + „fehlerhaftes
    Plugin deaktivieren"-Pfad (Error-Boundary existiert bereits).
80. **Plugin-Doku-Site.** Authoring-Guide aus dem Manifest generieren.
    *Ergebnis:* eine echte Plugin-Plattform.

## Phase G — Alerting, Benachrichtigung, Automatisierung (Runs 81–88)

> Read-only-sicher: schreibt **nie** zu Claude zurück, beobachtet nur.

81. ⚙️ **Read-only Regel-Engine.** Bedingungen über den Event-Strom (Kosten > X,
    Fehler-Spike, Session > N min, MCP-Fehler), in DB, beim Ingest ausgewertet.
82. **In-App-Benachrichtigungen.** Toast/Inbox-Panel, wenn eine Regel feuert.
83. **Desktop-Notifications.** Regel-Treffer an native Electron-`Notification`
    brücken.
84. **Optionaler Webhook-Ausgang.** Slack/Discord-Webhook bei Treffer; per
    Default aus.
85. **Täglicher/wöchentlicher Digest.** Zusammenfassung (Events, Kosten, Top-
    Tools, Fehler) als Datei/E-Mail-fertiges HTML.
86. **Anomalie-Erkennung.** Steigende Latenz/Fehlerrate vs. Baseline („wird
    Claude schlechter?").
87. **Kosten-Alarm.** Warnen, wenn die Burn-Rate über Budget projiziert (Run 32–34).
88. **Quiet Hours.** Nicht-kritische Alerts nach Zeitplan unterdrücken.
    *Ergebnis:* proaktive, unaufdringliche Aufmerksamkeit.

## Phase H — Integrationen & weitere Datenquellen (Runs 89–95)

89. ⚙️ **Optionaler OTLP-Receiver.** Zweiter read-only Eingang: Claude Codes
    OpenTelemetry (OTLP/HTTP, Metriken+Logs) annehmen (opt-in), in dieselben
    Tabellen normalisieren. Isoliert halten, per Default aus.
90. **OTLP-Metriken-Mapping.** OTel-Token/Kosten/Latenz auf das Datenmodell
    abbilden; mit Hook- + ccusage-Daten reconcilen.
91. **Prometheus-Export.** `GET /api/metrics` (Prometheus-Text), damit Grafana
    ebenfalls scrapen kann.
92. **Git-/PR-Korrelation.** Sessions an Branches/PRs binden (aus Run 26); zeigen,
    welche Session welchen PR berührt hat.
93. **Multi-Maschinen-Aggregation (optional).** Read-only Sync einer zweiten
    Maschinen-DB in eine kombinierte Ansicht.
94. **Datenexport/-import.** CSV/JSON-Export jedes Widgets;
    `scripts/export-log.mjs` ausbauen; Schema dokumentieren.
95. **API-Doku (OpenAPI).** Alle Lesepfade + den einzigen Schreibpfad
    dokumentieren. *Ergebnis:* offener, integrierbarer Daten-Hub.

## Phase I — Politur & Performance (Runs 96–99)

96. **Barrierefreiheit-Audit.** Voller a11y-Pass (ARIA, Fokus, Kontrast,
    Tastatur) + automatische axe-Checks in CI.
97. ⚙️ **Performance-Pass.** Virtualisierte Listen (Live-Stream, Kanban at scale),
    Query/Index-Tuning, memoisierte Aggregate, Bundle-Analyse + Budgets.
98. **Onboarding-Assistent.** First-Run-Wizard (Hooks verbinden, seed/import,
    Tour) in App + Electron-Tray.
99. **Doku-Refresh.** README/Architektur/Plugin-Docs auf den neuen Stand;
    Screenshots/GIFs neu; `src/lib/demo.ts` zeigt die neuen Widgets.

## Phase Z — Visuelle & funktionale Gesamtabnahme (Runs 100–119, **VOR dem Release**)

Erst wenn **jeder** dieser 20 Checks grün ist, wird v1.0 freigegeben. Jeder Run
nimmt Playwright-Screenshots (De **und** En, Light/Dark, Breiten: Desktop,
2560px, 3840px, Mobil) auf, prüft das Thema **einzeln** und klickt **jede**
Interaktion einmal an (jeder Button, jede sortierbare Spalte, jeder Balken,
jede Zelle, jeder Tooltip). Bilder werden als CI-Artefakte gesammelt; jede
Abweichung wird als Folge-Fix notiert. Konsole muss frei von Fehlern/Hydration
sein.

100. 📐 **Layout & Raster.** Abstände, Gutter, Padding, Ausrichtung, gleiche
     Panel-Höhen, kein Überlauf — über alle Breakpoints.
101. 🎨 **Farbsystem & Kontrast.** Palette, Akzent-/Statusfarben,
     Farbenblind-Palette, Dark/Light-Kontrast (WCAG AA) je Widget.
102. 🔤 **Typografie & Lesbarkeit.** Schriftgrößen, Zeilenhöhe, Truncation/
     Ellipsis, `tabular-nums`, Mono-Felder, lange Texte/Übersetzungen.
103. 📊 **KPI-Bar & Übersicht.** Werte, Count-up-Animation, Sparkline,
     Lade-/Leer-/Fehlerzustände.
104. 🗂️ **Kanban (Sessions).** Spalten, Karten, Status-Punkte, Filter, Klick
     auf jede Karte + Drilldown.
105. 📡 **Live-Stream & Jetzt-live.** SSE-Verbindung, Einlauf-Animation,
     Pulse/Ping, tickender Timer.
106. 💸 **Token-/Kosten-Chart.** Achsen, Tooltips, Hover, Legende, Umschalter
     (Tokens/Kosten, USD/EUR).
107. 🕸️ **Tool-Graph (3D).** Laden, Drehen/Zoom, Knoten-Klick, Labels,
     Performance.
108. ⛽ **Budget-Gauge.** Schwellen-Farben, Anzeige, Überschreitung, Animation.
109. 🔥 **Heatmap (Aktivität).** Punchcard-Zellen, Farbstufen, p95-Clamp,
     Tooltip jeder Zelle.
110. 🛠️ **Top-Tools & Tool-Frequenz.** Balken, Sortierung, Hover — jeden Balken
     einzeln prüfen.
111. 🧩 **Datei-Hotspots (Treemap).** Kacheln, Farben, Tooltip, Klick.
112. ⏱️ **Session-Timeline.** Spuren, Zeitfenster, Zoom/Scroll.
113. 📈 **Latenz.** Histogramm-Buckets, p50/p95/p99, jeder Balken, Tooltip.
114. ❗ **Fehlerrate & Fehler-Panel.** Serie, Top-Fehler-Tools, Fehlerliste,
     Klick.
115. 🍩 **Modelle-Donut.** Segmente, Legende, Center-Total, Hover jedes Segment.
116. 🌊 **Sankey-Fluss.** Knoten/Links, Hover, Other-Bucket, Label-Lesbarkeit.
117. 🏆 **Projekt-Leaderboard.** Sortierbare Spalten (jede Spalte klicken),
     Medaillen, Hover-Zeilen.
118. 🔢 **Streak/Produktivität & Subagent-Baum.** Streak-Kacheln, jeder Balken,
     Auf-/Zuklappen jedes Knotens.
119. 🔌 **MCP-Server + globale Interaktionen.** MCP-Zeilen/Balken; Sprach- &
     Theme-Umschalter, Suche filtert alle Widgets, Layout-Reset/Drag, Info-
     Hints überall; alle `/api/*`-Routen antworten; Demo-Modus zeigt alle
     Widgets. Abschluss-Sammlung aller Screenshots.

### Z-Demo. 🌐 Demo-Website-Politur (nur die Pages-Demo, `src/lib/demo.ts`)

Die öffentliche Demo (läuft idealerweise **nur** auf der Website) wirkt aktuell
**zu hektisch und inkonsistent**. Ruhiger, glaubwürdiger und stabil machen:

- **Sessions bleiben bestehen.** Mehrere offene Sessions sind ok, aber eine
  **beendete Session verschwindet nie wieder** — sie bleibt in der „Beendet"-
  Spalte (kein Wegrotieren/Abschneiden der Historie wie heute).
- **Geld steigt realistisch & monoton.** Kosten/Tokens nur **aufwärts**, in
  kleinen, plausiblen Schritten — **kein Hoch-/Runter-Springen**.
- **Weniger Hektik.** Ereignis-Takt entschleunigen, keine sprunghaften
  Zahlensprünge; Werte sanft fortschreiben statt neu zu würfeln.
- **3D-Graph: episch statt zappelig.** Optik ist gut, aber er soll **nicht
  springen** — eine **langsame, gleichmäßige (epische) Auto-Rotation**. Bei
  **manueller** Bewegung nicht sofort weiterdrehen, sondern **15 s warten**,
  dann sanft wieder die Auto-Rotation aufnehmen.
- **Konsistenz.** Über Reloads hinweg ein stimmiges, kuratiertes Bild (seedbare
  Demo-Daten), damit Screenshots/GIFs reproduzierbar sind.

## Phase Ω — Beta-Release (Run 120, **letzter Schritt**)

120. 🚀 **v1.0.0-beta — unsignierte Beta für alle Betriebssysteme** (erst nach
     grüner Phase Z). Kein Code-Signing, ausdrücklich als **Beta** gekennzeichnet:
     - Builds + Downloads für **alle OS**: **Windows** (`.exe`/portable),
       **macOS** (`.dmg`, Intel + Apple Silicon) und **Linux**
       (`AppImage`/`.deb`) — alle **unsigniert** (Installations-Hinweis je OS
       in der README, z. B. Gatekeeper/SmartScreen-Umgehung für Beta-Builds).
     - GitHub-Release `v1.0.0-beta` (Pre-Release-Flag gesetzt) mit allen
       Artefakten als Download, Changelog, Version-Bump auf `1.0.0-beta`.
     - Pages-Demo mit allen Widgets verlinkt.
     *Ergebnis:* öffentliche Beta zum Ausprobieren auf jedem System — als Beta,
     unsigniert, alle OS als Download.

## Lizenzmodell (dual / source-available)

**Privat & nicht-kommerziell: kostenlos. Firmen & kommerzieller Einsatz:
kostenpflichtige Lizenz.** Das ist als *source-available* Dual-Lizenz gut
umsetzbar (kein OSI-„Open Source", aber Quelltext einsehbar):

- **Standardweg:** `LICENSE` = **PolyForm Noncommercial 1.0.0** (erlaubt jede
  nicht-kommerzielle Nutzung gratis; kommerzielle Nutzung ausdrücklich
  ausgenommen) **+** eine `COMMERCIAL.md`, die den Erwerb einer kommerziellen
  Lizenz beschreibt (Kontakt/Preis). Dieselbe Codebasis wird damit doppelt
  lizenziert.
- **Alternative:** **Business Source License (BSL 1.1)** mit „Additional Use
  Grant" (nicht-kommerziell frei) und Change-Date → fällt nach X Jahren auf
  eine OSS-Lizenz zurück.
- **Hinweis:** Solche Lizenzen sind durchsetzbar, aber rechtlich verbindliche
  Beratung gehört vor das Release. Bis dahin keine widersprüchliche Lizenz
  committen.

Umsetzung erfolgt in der Release-Phase (Run 120): `LICENSE` + `COMMERCIAL.md`
hinzufügen, Lizenz-Header/`package.json`-`license`-Feld setzen, README-Abschnitt
„Lizenz" ergänzen.

---

## Überblick: Phasen auf einen Blick

| Phase | Runs | Fokus | Warum hier |
|---|---|---|---|
| A | 1–14 | Fundament härten | CI/Tests/Migrationen zuerst — sonst Blindflug |
| B | 15–28 | Mehr auslesen | Daten-Tiefe braucht sicheres Migrationssystem |
| C | 29–37 | Ökonomie | Kosten/Tokens vertrauenswürdig machen |
| D | 38–62 | Visualisierung | Sichtbarmachen, was B/C erfassen |
| E | 63–72 | Drill-down | Tiefe pro Session/Event/Tool |
| F | 73–80 | Plugin-Plattform | aus „Registry" wird echtes Ökosystem |
| G | 81–88 | Alerting | proaktiv, read-only-sicher |
| H | 89–95 | Integrationen | OTLP/Prometheus/Git — offener Hub |
| I | 96–99 | Politur & Performance | a11y, Performance, Onboarding, Docs |
| Z | 100–119 | Visuelle & funktionale Gesamtabnahme | 20 Einzel-Checks **vor** Release |
| Ω | 120 | Beta-Release | v1.0.0-beta, **unsigniert**, alle OS als Download — nach grüner Phase Z |

**Leitstern:** Nach 120 Runs — inklusive einer 20-teiligen visuellen &
funktionalen Gesamtabnahme **vor** dem Release — ist Claude Mission Control das
vollständigste, am besten gehärtete, lokal-first Observability-Tool für Claude
Code — ohne die goldene Regel je gebrochen zu haben.
