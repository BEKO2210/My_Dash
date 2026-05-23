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

  "common.allProjects": "Alle Projekte",
  "common.close": "Schließen",
  "common.retry": "Erneut versuchen",
  "common.noResults": "Keine Treffer.",

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
  "tokens.tok": "tok",
  "tokens.emptyNone": "Noch keine Nutzungsdaten von ccusage.",
  "tokens.emptyUnavailable": "ccusage nicht verfügbar (offline oder keine Claude-Daten gefunden).",
  "tokens.empty24h": "Keine Aktivität in den letzten 24 h.",
  "tokens.cost": "Kosten",
  "tokens.input": "Input",
  "tokens.output": "Output",
  "tokens.cache": "Cache",

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

  "common.allProjects": "All projects",
  "common.close": "Close",
  "common.retry": "Retry",
  "common.noResults": "No matches.",

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
  "tokens.tok": "tok",
  "tokens.emptyNone": "No usage data from ccusage yet.",
  "tokens.emptyUnavailable": "ccusage unavailable (offline or no Claude data found).",
  "tokens.empty24h": "No activity in the last 24h.",
  "tokens.cost": "Cost",
  "tokens.input": "Input",
  "tokens.output": "Output",
  "tokens.cache": "Cache",

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
