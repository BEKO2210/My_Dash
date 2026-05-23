"use client";

import { useSyncExternalStore } from "react";

// Lightweight i18n: a flat dictionary + a hook backed by an external store over
// localStorage (hydration-safe, default German). No provider needed — every
// useT() consumer subscribes to language changes directly.
export type Lang = "de" | "en";
const KEY = "mc-lang";
const listeners = new Set<() => void>();

function readLang(): Lang {
  try {
    return localStorage.getItem(KEY) === "en" ? "en" : "de";
  } catch {
    return "de";
  }
}

function writeLang(l: Lang) {
  try {
    localStorage.setItem(KEY, l);
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((fn) => fn());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

const DE: Record<string, string> = {
  "header.subtitle": "Live-Observability für Claude Code",
  "header.info":
    "Read-only Live-Dashboard für Claude Code: Aktivität aus Hooks → SQLite → UI. Die KI rendert dieses Dashboard nie — die Ansicht kann nichts am System ändern.",
  "header.connected": "verbunden",
  "header.disconnected": "getrennt",
  "header.eventsInfo":
    "Events im Live-Puffer dieses Browsers (zuletzt empfangene, max. 300) — kein Gesamtzähler. Die Zahl wächst mit neuen Events und startet beim Neuladen frisch aus den letzten ~100.",
  "footer.text": "read-only · Daten aus Hooks → SQLite → UI · die KI rendert dieses Dashboard nie",

  "landing.badge": "Live-Demo",
  "landing.tagline": "Live-Observability für Claude Code",
  "landing.lead":
    "Ein lokales, read-only Dashboard, das jede Aktion von Claude Code in Echtzeit sichtbar macht: Live-Event-Stream, Session-Kanban, Token-/Kosten-Charts und ein animierter 3D-Tool-Graph.",
  "landing.f1t": "Live-Event-Stream",
  "landing.f1d": "Jeder Hook-Event in Echtzeit — Prompts, Tool-Aufrufe, Stops.",
  "landing.f2t": "Session-Kanban",
  "landing.f2d": "Alle Sessions nach Status: aktiv, wartet, beendet.",
  "landing.f3t": "Tokens & Kosten",
  "landing.f3d": "Tägliche und 24h-Nutzung mit Kosten — aus ccusage.",
  "landing.f4t": "3D-Tool-Graph",
  "landing.f4d": "Session → Tool → Datei/Befehl/URL, aktive Pfade leuchten.",
  "landing.how": "Daten fließen in eine Richtung: Hooks → SQLite → UI. Die KI rendert dieses Dashboard nie.",
  "landing.demoNote":
    "Unten läuft eine Live-Demo mit zufälligen, simulierten Claude-Tasks — komplett im Browser, ohne Server.",
  "landing.github": "Auf GitHub ansehen",
  "landing.scroll": "Live-Demo ↓",

  "download.title": "Herunterladen",
  "download.subtitle":
    "Lokale Desktop-App für Claude Code — installieren, starten, verbinden. Für Windows, macOS und Linux.",
  "download.for": "Download für",
  "download.download": "Herunterladen",
  "download.detected": "Dein System",
  "download.winFile": "Windows 10/11 · .exe-Installer",
  "download.macFile": "macOS (Apple Silicon) · .dmg",
  "download.linuxFile": "Linux · .AppImage",
  "download.unsigned":
    "Unsigniert (Alpha): Windows-SmartScreen bzw. macOS-Gatekeeper einmalig bestätigen.",
  "download.allReleases": "Alle Versionen & Release-Notes →",

  "common.allProjects": "Alle Projekte",
  "common.close": "Schließen",
  "common.retry": "Erneut versuchen",
  "common.noResults": "Keine Treffer.",
  "common.loading": "Lädt…",
  "kpi.active": "Aktive Sessions",
  "kpi.events": "Events heute",
  "kpi.tools": "Tool-Aufrufe heute",
  "kpi.errors": "Fehlerquote heute",
  "kpi.cost": "Kosten heute",
  "heatmap.title": "Aktivität",
  "heatmap.info": "Aktivität nach Wochentag und Stunde (lokale Zeit), aus dem Event-Verlauf.",
  "heatmap.empty": "Noch keine Aktivität.",
  "heatmap.cell": "Events",
  "heatmap.less": "weniger",
  "heatmap.more": "mehr",
  "tools.title": "Top-Tools",
  "tools.info": "Häufigste Tool-Aufrufe im Zeitraum. Violett = MCP, blau = eingebaut. ✗ = Fehler.",
  "tools.empty": "Noch keine Tool-Aufrufe.",
  "tools.range7d": "7T",
  "tools.range30d": "30T",
  "tools.rangeAll": "Alle",
  "files.title": "Datei-Hotspots",
  "files.info": "Meistbearbeitete Dateien (Fläche & Farbe = geänderte Zeilen) im Zeitraum.",
  "files.empty": "Noch keine Datei-Änderungen.",
  "files.edits": "Bearbeitungen",
  "timeline.title": "Session-Timeline",
  "timeline.info": "Sessions als Zeitbalken (Start bis Ende), eingefärbt nach Status.",
  "timeline.empty": "Keine Sessions im Zeitraum.",
  "latency.title": "Tool-Latenz",
  "latency.info": "Verteilung der Tool-Dauern (logarithmische Buckets) mit p50/p95/p99.",
  "latency.empty": "Noch keine Dauer-Daten.",
  "latency.all": "Alle Tools",
  "latency.tool": "Tool filtern",
  "latency.max": "max",
  "errors.title": "Fehlerrate",
  "errors.info": "Anteil fehlgeschlagener Tool-Aufrufe, Verlauf und die fehleranfälligsten Tools.",
  "errors.empty": "Noch keine Tool-Aufrufe.",
  "errors.failures": "Fehler",
  "errors.topTools": "Fehleranfälligste Tools",
  "errors.none": "Keine Fehler im Zeitraum. 🎉",
  "donut.title": "Modelle",
  "donut.info": "Anteil pro Modell an Tokens bzw. Kosten.",
  "donut.empty": "Noch keine Modelldaten.",
  "donut.total": "gesamt",
  "donut.other": "Andere",
  "sankey.title": "Fluss",
  "sankey.info": "Fluss von Projekt → Tool → Ressourcentyp aus den Tool-Aufrufen.",
  "sankey.empty": "Noch keine Tool-Ziele.",

  "leaderboard.title": "Projekt-Rangliste",
  "leaderboard.info": "Projekte nach Kosten, Sessions, Tools und Tokens. Spalte klicken zum Sortieren.",
  "leaderboard.empty": "Noch keine Projekte.",
  "leaderboard.project": "Projekt",
  "leaderboard.sessions": "Sessions",
  "leaderboard.tools": "Tools",
  "leaderboard.tokens": "Tokens",
  "leaderboard.cost": "Kosten",

  "now.title": "Jetzt live",
  "now.info": "Die aktive Session in Echtzeit: verstrichene Zeit, Kennzahlen und die letzten Aktionen.",
  "now.idle": "Gerade keine aktive Session.",
  "now.idleHint": "Starte Claude Code – die laufende Session erscheint hier live.",
  "now.elapsed": "Laufzeit",
  "now.tools": "Tools",
  "now.events": "Events",
  "now.cost": "Kosten",
  "now.lastActions": "Letzte Aktionen",
  "now.noActions": "Noch keine Aktionen in dieser Session.",
  "now.totalTokens": "Tokens gesamt",

  "prompts.title": "Prompt-Verlauf",
  "prompts.info": "Chronologische, durchsuchbare Liste deiner Prompts (Secrets werden vor dem Speichern entfernt).",
  "prompts.empty": "Noch keine Prompts.",
  "prompts.tokens": "Tokens",

  "streak.title": "Streak & Produktivität",
  "streak.info": "Tages-Streak aktiver Tage, Stoßzeiten und der Sessions-pro-Tag-Trend.",
  "streak.empty": "Noch keine Aktivität.",
  "streak.current": "Aktuell",
  "streak.longest": "Längste",
  "streak.activeDays": "Aktive Tage",
  "streak.peak": "Stoßzeit",
  "streak.perDay": "Sessions pro Tag (30 T.)",
  "streak.peakHours": "Stoßzeiten (Stunde)",

  "subagents.title": "Subagent-Baum",
  "subagents.info": "Welche Sessions Subagenten per Task gestartet haben – aufklappen zeigt die einzelnen Subagenten.",
  "subagents.empty": "Noch keine Subagenten.",
  "subagents.emptyHint": "Sobald Claude einen Task-Subagenten startet, erscheint er hier.",
  "subagents.unnamed": "Unbenannter Subagent",

  "mcp.title": "MCP-Server",
  "mcp.info": "Aktivität je MCP-Server: Aufrufe, Fehlerrate und mittlere Latenz.",
  "mcp.empty": "Noch keine MCP-Aufrufe.",
  "mcp.emptyHint": "Sobald ein MCP-Tool (mcp__…) läuft, erscheint sein Server hier.",
  "mcp.errors": "Fehler",
  "mcp.tools": "Tools",

  "compaction.title": "Kompaktierungen",
  "compaction.info": "Wann und wie oft der Kontext komprimiert wurde (auto vs. manuell).",
  "compaction.empty": "Noch keine Kompaktierungen.",
  "compaction.emptyHint": "Sobald Claude den Kontext komprimiert (PreCompact), erscheint es hier.",
  "compaction.total": "Gesamt",
  "compaction.auto": "Auto",
  "compaction.manual": "Manuell",
  "compaction.last": "Zuletzt",
  "compaction.perDay": "Pro Tag (14 T.)",
  "compaction.trigger.auto": "auto",
  "compaction.trigger.manual": "manuell",

  "tags.title": "Themen-Cloud",
  "tags.info": "Häufige Begriffe aus deinen Prompts – lokal berechnet, ohne LLM. Größe = Häufigkeit.",
  "tags.empty": "Noch keine Begriffe.",
  "tags.emptyHint": "Sobald du Prompts schreibst, erscheinen die häufigsten Begriffe hier.",

  "burn.title": "Token-Verbrauch je Tool",
  "burn.info": "Wo die meisten Tokens verbrennen – geschätzt aus der Tool-I/O-Größe (Zeichen ÷ 4).",
  "burn.empty": "Noch keine Tool-Daten.",

  "search.label": "Sessions und Events durchsuchen",
  "search.placeholder": "Suchen…",
  "search.clear": "Suche löschen",

  "layout.drag": "Zum Umordnen ziehen",
  "layout.reset": "Layout zurücksetzen",

  "status.active": "Aktiv",
  "status.waiting": "Wartet",
  "status.ended": "Beendet",

  "kanban.title": "Sessions",
  "kanban.info":
    "Alle Claude-Code-Sessions nach Status: Aktiv (arbeitet gerade), Wartet (auf deine Eingabe), Beendet. Inaktive Sessions werden nach 30 min automatisch als beendet geführt. Filter rechts nach Projekt.",
  "kanban.empty": "leer",
  "kanban.stale": "inaktiv — automatisch beendet",
  "kanban.sessionFallback": "Session",
  "kanban.openDetail": "Details öffnen",
  "kanban.detail": "Session-Details",
  "kanban.firstSeen": "Zuerst gesehen",
  "kanban.lastSeen": "Zuletzt aktiv",
  "kanban.eventsLabel": "Events",
  "kanban.toolsLabel": "Tools",
  "kanban.recentEvents": "Letzte Events",
  "kanban.noEvents": "Keine Events für diese Session.",

  "stream.title": "Live Stream",
  "stream.info":
    "Live-Strom aller Hook-Events in Echtzeit (neueste oben): Session-Start/-Ende, Prompts, Tool-Aufrufe und Stops. Speist sich per SSE aus den Claude-Code-Hooks.",
  "stream.live": "live",
  "stream.emptyTitle": "Noch keine Events.",
  "stream.emptyPre": "Starte eine Claude-Code-Session oder führe ",
  "stream.emptyPost": " aus.",

  "tokens.title": "Tokens & Kosten",
  "tokens.info":
    "Tägliche Token-Nutzung und Kosten aus ccusage. Rechts umschaltbar zwischen Tokens (Input/Output/Cache) und Kosten in € (aus USD über EUR_PER_USD umgerechnet).",
  "tokens.modeTokens": "Tokens",
  "tokens.modeCost": "Kosten",
  "tokens.range24h": "24 h",
  "tokens.rangeDaily": "Täglich",
  "tokens.rangeMonthly": "Monat",
  "tokens.tok": "tok",
  "tokens.emptyNone": "Noch keine Nutzungsdaten von ccusage.",
  "tokens.emptyUnavailable": "ccusage nicht verfügbar (offline oder keine Claude-Daten gefunden).",
  "tokens.empty24h": "Keine Aktivität in den letzten 24 h.",
  "tokens.cost": "Kosten",
  "tokens.input": "Input",
  "tokens.output": "Output",
  "tokens.cache": "Cache",

  "budget.title": "Budget",
  "budget.info": "Heutige & monatliche Ausgaben gegen dein Budget (USD), mit Hochrechnung.",
  "budget.daily": "Heute",
  "budget.monthly": "Dieser Monat",
  "budget.projected": "Hochrechnung",
  "budget.none": "Kein Budget gesetzt.",
  "graph.title": "Tool-Graph (3D)",
  "graph.info":
    "Beziehungen Session → Tool → Ziel (Datei, Befehl, URL, Muster). Gleiche Ziele über Sessions hinweg teilen sich einen Knoten. Aktive Sessions leuchten. Knoten anklicken für Details, Vollbild oben rechts.",
  "graph.fullscreen": "Vollbild",
  "graph.shrink": "Verkleinern",
  "graph.shrinkTitle": "Verkleinern (Esc)",
  "graph.empty": "Noch keine Tool-Aufrufe.",
  "graph.noWebgl":
    "3D-Ansicht nicht verfügbar: Dieser Browser bzw. dieses Gerät unterstützt kein WebGL. Die übrigen Panels funktionieren normal.",
  "graph.kind.session": "Session",
  "graph.kind.prompt": "Prompt",
  "graph.kind.tool": "Tool",
  "graph.kind.file": "Datei",
  "graph.kind.command": "Befehl",
  "graph.kind.url": "URL",
  "graph.kind.pattern": "Muster",
  "graph.project": "Projekt",
  "graph.status": "Status",
  "graph.lastActivity": "Letzte Aktivität",
  "graph.id": "ID",
  "graph.prompts": "Prompts",
  "graph.toolsConnected": "Tools verbunden",
  "graph.calls": "Aufrufe",
  "graph.targetsTouched": "Ziele berührt",
  "graph.program": "Programm",
  "graph.example": "Beispiel",
  "graph.fromTools": "Von Tools",
  "graph.address": "Adresse",
  "graph.pattern": "Muster",
  "graph.path": "Pfad",
  "graph.fromToolsTouched": "Von Tools berührt",
  "graph.from": "Von",
  "graph.fromYou": "Du",
  "graph.fromAgent": "Claude → Agent",
  "graph.time": "Zeit",

  "error.couldNotLoad": "konnte nicht geladen werden.",
  "error.generic": "Widget-Fehler.",
};

const EN: Record<string, string> = {
  "header.subtitle": "Live observability for Claude Code",
  "header.info":
    "Read-only live dashboard for Claude Code: activity from hooks → SQLite → UI. The AI never renders this dashboard — the view can't change anything in the system.",
  "header.connected": "connected",
  "header.disconnected": "disconnected",
  "header.eventsInfo":
    "Events in this browser's live buffer (most recent, max 300) — not a total counter. It grows with new events and re-seeds from the latest ~100 on reload.",
  "footer.text": "read-only · data from hooks → SQLite → UI · the AI never renders this dashboard",

  "landing.badge": "Live demo",
  "landing.tagline": "Live observability for Claude Code",
  "landing.lead":
    "A local, read-only dashboard that shows every Claude Code action in real time: live event stream, session kanban, token/cost charts and an animated 3D tool-call graph.",
  "landing.f1t": "Live event stream",
  "landing.f1d": "Every hook event in real time — prompts, tool calls, stops.",
  "landing.f2t": "Session kanban",
  "landing.f2d": "All sessions by status: active, waiting, ended.",
  "landing.f3t": "Tokens & cost",
  "landing.f3d": "Daily and 24h usage with cost — from ccusage.",
  "landing.f4t": "3D tool graph",
  "landing.f4d": "Session → tool → file/command/URL, active paths glow.",
  "landing.how": "Data flows one way: hooks → SQLite → UI. The AI never renders this dashboard.",
  "landing.demoNote":
    "A live demo with random, simulated Claude tasks is running below — entirely in your browser, no server.",
  "landing.github": "View on GitHub",
  "landing.scroll": "Live demo ↓",

  "download.title": "Download",
  "download.subtitle":
    "Local desktop app for Claude Code — install, launch, connect. For Windows, macOS and Linux.",
  "download.for": "Download for",
  "download.download": "Download",
  "download.detected": "Your system",
  "download.winFile": "Windows 10/11 · .exe installer",
  "download.macFile": "macOS (Apple Silicon) · .dmg",
  "download.linuxFile": "Linux · .AppImage",
  "download.unsigned":
    "Unsigned (alpha): confirm the Windows SmartScreen / macOS Gatekeeper prompt once.",
  "download.allReleases": "All versions & release notes →",

  "common.allProjects": "All projects",
  "common.close": "Close",
  "common.retry": "Retry",
  "common.noResults": "No matches.",
  "common.loading": "Loading…",
  "kpi.active": "Active sessions",
  "kpi.events": "Events today",
  "kpi.tools": "Tool calls today",
  "kpi.errors": "Error rate today",
  "kpi.cost": "Cost today",
  "heatmap.title": "Activity",
  "heatmap.info": "Activity by weekday and hour (local time), from the event history.",
  "heatmap.empty": "No activity yet.",
  "heatmap.cell": "events",
  "heatmap.less": "less",
  "heatmap.more": "more",
  "tools.title": "Top tools",
  "tools.info": "Most-used tools in the range. Violet = MCP, blue = built-in. ✗ = errors.",
  "tools.empty": "No tool calls yet.",
  "tools.range7d": "7d",
  "tools.range30d": "30d",
  "tools.rangeAll": "All",
  "files.title": "File hotspots",
  "files.info": "Most-edited files (area & color = changed lines) in the range.",
  "files.empty": "No file changes yet.",
  "files.edits": "edits",
  "timeline.title": "Session timeline",
  "timeline.info": "Sessions as time bars (start to end), colored by status.",
  "timeline.empty": "No sessions in range.",
  "latency.title": "Tool latency",
  "latency.info": "Distribution of tool durations (log buckets) with p50/p95/p99.",
  "latency.empty": "No duration data yet.",
  "latency.all": "All tools",
  "latency.tool": "Filter tool",
  "latency.max": "max",
  "errors.title": "Error rate",
  "errors.info": "Share of failed tool calls, the trend, and the most failure-prone tools.",
  "errors.empty": "No tool calls yet.",
  "errors.failures": "failed",
  "errors.topTools": "Most failure-prone tools",
  "errors.none": "No errors in range. 🎉",
  "donut.title": "Models",
  "donut.info": "Share per model of tokens or cost.",
  "donut.empty": "No model data yet.",
  "donut.total": "total",
  "donut.other": "Other",
  "sankey.title": "Flow",
  "sankey.info": "Flow of project → tool → resource kind from tool calls.",
  "sankey.empty": "No tool targets yet.",

  "leaderboard.title": "Project leaderboard",
  "leaderboard.info": "Projects by cost, sessions, tools and tokens. Click a column to sort.",
  "leaderboard.empty": "No projects yet.",
  "leaderboard.project": "Project",
  "leaderboard.sessions": "Sessions",
  "leaderboard.tools": "Tools",
  "leaderboard.tokens": "Tokens",
  "leaderboard.cost": "Cost",

  "now.title": "Live now",
  "now.info": "The active session in real time: elapsed time, key metrics and the latest actions.",
  "now.idle": "No active session right now.",
  "now.idleHint": "Start Claude Code — the running session shows up here live.",
  "now.elapsed": "Elapsed",
  "now.tools": "Tools",
  "now.events": "Events",
  "now.cost": "Cost",
  "now.lastActions": "Latest actions",
  "now.noActions": "No actions in this session yet.",
  "now.totalTokens": "Total tokens",

  "prompts.title": "Prompt history",
  "prompts.info": "Chronological, searchable list of your prompts (secrets are stripped before storage).",
  "prompts.empty": "No prompts yet.",
  "prompts.tokens": "tokens",

  "streak.title": "Streak & productivity",
  "streak.info": "Day-streak of active days, peak hours and the sessions-per-day trend.",
  "streak.empty": "No activity yet.",
  "streak.current": "Current",
  "streak.longest": "Longest",
  "streak.activeDays": "Active days",
  "streak.peak": "Peak hour",
  "streak.perDay": "Sessions per day (30d)",
  "streak.peakHours": "Peak hours (hour)",

  "subagents.title": "Subagent tree",
  "subagents.info": "Which sessions spawned subagents via Task — expand to see the individual subagents.",
  "subagents.empty": "No subagents yet.",
  "subagents.emptyHint": "As soon as Claude launches a Task subagent, it shows up here.",
  "subagents.unnamed": "Unnamed subagent",

  "mcp.title": "MCP servers",
  "mcp.info": "Activity per MCP server: calls, error rate and average latency.",
  "mcp.empty": "No MCP calls yet.",
  "mcp.emptyHint": "As soon as an MCP tool (mcp__…) runs, its server appears here.",
  "mcp.errors": "errors",
  "mcp.tools": "tools",

  "compaction.title": "Compactions",
  "compaction.info": "When and how often the context was compacted (auto vs. manual).",
  "compaction.empty": "No compactions yet.",
  "compaction.emptyHint": "As soon as Claude compacts the context (PreCompact), it shows up here.",
  "compaction.total": "Total",
  "compaction.auto": "Auto",
  "compaction.manual": "Manual",
  "compaction.last": "Last",
  "compaction.perDay": "Per day (14d)",
  "compaction.trigger.auto": "auto",
  "compaction.trigger.manual": "manual",

  "tags.title": "Topic cloud",
  "tags.info": "Frequent terms from your prompts — computed locally, no LLM. Size = frequency.",
  "tags.empty": "No terms yet.",
  "tags.emptyHint": "As soon as you write prompts, the most frequent terms appear here.",

  "burn.title": "Token burn per tool",
  "burn.info": "Where most tokens burn — estimated from tool I/O size (chars ÷ 4).",
  "burn.empty": "No tool data yet.",

  "search.label": "Search sessions and events",
  "search.placeholder": "Search…",
  "search.clear": "Clear search",

  "layout.drag": "Drag to reorder",
  "layout.reset": "Reset layout",

  "status.active": "Active",
  "status.waiting": "Waiting",
  "status.ended": "Ended",

  "kanban.title": "Sessions",
  "kanban.info":
    "All Claude Code sessions by status: Active (working now), Waiting (for your input), Ended. Inactive sessions are auto-ended after 30 min. Filter by project on the right.",
  "kanban.empty": "empty",
  "kanban.stale": "inactive — auto-ended",
  "kanban.sessionFallback": "Session",
  "kanban.openDetail": "Open details",
  "kanban.detail": "Session details",
  "kanban.firstSeen": "First seen",
  "kanban.lastSeen": "Last active",
  "kanban.eventsLabel": "Events",
  "kanban.toolsLabel": "Tools",
  "kanban.recentEvents": "Recent events",
  "kanban.noEvents": "No events for this session.",

  "stream.title": "Live Stream",
  "stream.info":
    "Live stream of all hook events in real time (newest on top): session start/end, prompts, tool calls and stops. Fed via SSE from the Claude Code hooks.",
  "stream.live": "live",
  "stream.emptyTitle": "No events yet.",
  "stream.emptyPre": "Start a Claude Code session or run ",
  "stream.emptyPost": ".",

  "tokens.title": "Tokens & Cost",
  "tokens.info":
    "Daily token usage and cost from ccusage. Toggle on the right between tokens (input/output/cache) and cost in € (converted from USD via EUR_PER_USD).",
  "tokens.modeTokens": "Tokens",
  "tokens.modeCost": "Cost",
  "tokens.range24h": "24h",
  "tokens.rangeDaily": "Daily",
  "tokens.rangeMonthly": "Month",
  "tokens.tok": "tok",
  "tokens.emptyNone": "No usage data from ccusage yet.",
  "tokens.emptyUnavailable": "ccusage unavailable (offline or no Claude data found).",
  "tokens.empty24h": "No activity in the last 24h.",
  "tokens.cost": "Cost",
  "tokens.input": "Input",
  "tokens.output": "Output",
  "tokens.cache": "Cache",

  "budget.title": "Budget",
  "budget.info": "Today's & this month's spend against your budget (USD), with a projection.",
  "budget.daily": "Today",
  "budget.monthly": "This month",
  "budget.projected": "Projected",
  "budget.none": "No budget set.",
  "graph.title": "Tool Graph (3D)",
  "graph.info":
    "Relationships session → tool → target (file, command, URL, pattern). Equal targets across sessions share a node. Active sessions glow. Click a node for details; fullscreen top-right.",
  "graph.fullscreen": "Fullscreen",
  "graph.shrink": "Shrink",
  "graph.shrinkTitle": "Shrink (Esc)",
  "graph.empty": "No tool calls yet.",
  "graph.noWebgl":
    "3D view unavailable: this browser or device doesn't support WebGL. The other panels work normally.",
  "graph.kind.session": "Session",
  "graph.kind.prompt": "Prompt",
  "graph.kind.tool": "Tool",
  "graph.kind.file": "File",
  "graph.kind.command": "Command",
  "graph.kind.url": "URL",
  "graph.kind.pattern": "Pattern",
  "graph.project": "Project",
  "graph.status": "Status",
  "graph.lastActivity": "Last activity",
  "graph.id": "ID",
  "graph.prompts": "Prompts",
  "graph.toolsConnected": "Tools connected",
  "graph.calls": "Calls",
  "graph.targetsTouched": "Targets touched",
  "graph.program": "Program",
  "graph.example": "Example",
  "graph.fromTools": "From tools",
  "graph.address": "Address",
  "graph.pattern": "Pattern",
  "graph.path": "Path",
  "graph.fromToolsTouched": "Touched by tools",
  "graph.from": "From",
  "graph.fromYou": "You",
  "graph.fromAgent": "Claude → agent",
  "graph.time": "Time",

  "error.couldNotLoad": "couldn’t load.",
  "error.generic": "Widget error.",
};

const T: Record<Lang, Record<string, string>> = { de: DE, en: EN };

export function useT() {
  const lang = useSyncExternalStore(subscribe, readLang, () => "de" as Lang);
  const t = (key: string) => T[lang][key] ?? DE[key] ?? key;
  return { lang, t, setLang: writeLang };
}
