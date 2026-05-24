// Documentation catalog for the Features page. Pure metadata (no component
// imports) so the static page stays light. Names/descriptions reuse the widgets'
// existing i18n keys (`<x>.title` / `<x>.info`, both DE+EN), and the real
// screenshots live at /docs/widgets/<id>.png (populated) and <id>-empty.png.
export type WidgetCat = "overview" | "sessions" | "activity" | "tools" | "economy" | "quality";

export interface WidgetDoc {
  id: string; // matches #mc-widget-<id> and the screenshot filenames
  titleKey: string; // existing i18n title key
  infoKey: string; // existing i18n description key (DE+EN)
  category: WidgetCat;
}

export const CATEGORY_ORDER: WidgetCat[] = ["overview", "sessions", "activity", "tools", "economy", "quality"];

export const CATEGORY_LABEL: Record<WidgetCat, { de: string; en: string }> = {
  overview: { de: "Überblick", en: "Overview" },
  sessions: { de: "Sessions", en: "Sessions" },
  activity: { de: "Aktivität", en: "Activity" },
  tools: { de: "Tools & Dateien", en: "Tools & files" },
  economy: { de: "Kosten & Tokens", en: "Cost & tokens" },
  quality: { de: "Qualität", en: "Quality" },
};

export const WIDGET_DOCS: WidgetDoc[] = [
  { id: "kpi-bar", titleKey: "kpi.title", infoKey: "kpi.info", category: "overview" },
  { id: "kanban", titleKey: "kanban.title", infoKey: "kanban.info", category: "sessions" },
  { id: "live-stream", titleKey: "stream.title", infoKey: "stream.info", category: "sessions" },
  { id: "session-timeline", titleKey: "timeline.title", infoKey: "timeline.info", category: "sessions" },
  { id: "live-now", titleKey: "now.title", infoKey: "now.info", category: "sessions" },
  { id: "prompt-history", titleKey: "prompts.title", infoKey: "prompts.info", category: "sessions" },
  { id: "subagent-tree", titleKey: "subagents.title", infoKey: "subagents.info", category: "sessions" },
  { id: "session-duration", titleKey: "sessionDur.title", infoKey: "sessionDur.info", category: "sessions" },
  { id: "git-correlation", titleKey: "gitcorr.title", infoKey: "gitcorr.info", category: "sessions" },
  { id: "heatmap", titleKey: "heatmap.title", infoKey: "heatmap.info", category: "activity" },
  { id: "streak", titleKey: "streak.title", infoKey: "streak.info", category: "activity" },
  { id: "calendar-heatmap", titleKey: "calendar.title", infoKey: "calendar.info", category: "activity" },
  { id: "velocity", titleKey: "velocity.title", infoKey: "velocity.info", category: "activity" },
  { id: "tool-graph", titleKey: "graph.title", infoKey: "graph.info", category: "tools" },
  { id: "tool-frequency", titleKey: "tools.title", infoKey: "tools.info", category: "tools" },
  { id: "file-hotspots", titleKey: "files.title", infoKey: "files.info", category: "tools" },
  { id: "sankey-flow", titleKey: "sankey.title", infoKey: "sankey.info", category: "tools" },
  { id: "mcp-servers", titleKey: "mcp.title", infoKey: "mcp.info", category: "tools" },
  { id: "tag-cloud", titleKey: "tags.title", infoKey: "tags.info", category: "tools" },
  { id: "token-chart", titleKey: "tokens.title", infoKey: "tokens.info", category: "economy" },
  { id: "budget-gauge", titleKey: "budget.title", infoKey: "budget.info", category: "economy" },
  { id: "model-donut", titleKey: "donut.title", infoKey: "donut.info", category: "economy" },
  { id: "project-leaderboard", titleKey: "leaderboard.title", infoKey: "leaderboard.info", category: "economy" },
  { id: "token-burn", titleKey: "burn.title", infoKey: "burn.info", category: "economy" },
  { id: "latency", titleKey: "latency.title", infoKey: "latency.info", category: "quality" },
  { id: "error-rate", titleKey: "errors.title", infoKey: "errors.info", category: "quality" },
  { id: "compaction-timeline", titleKey: "compaction.title", infoKey: "compaction.info", category: "quality" },
  { id: "reliability", titleKey: "reliability.title", infoKey: "reliability.info", category: "quality" },
  { id: "incidents", titleKey: "incidents.title", infoKey: "incidents.info", category: "quality" },
  { id: "anomaly", titleKey: "anomaly.title", infoKey: "anomaly.info", category: "quality" },
];

// The settings a user can change on the live dashboard. Bilingual inline so the
// Features page can document each one. (Short labels reuse no i18n to keep the
// dict lean; this is documentation copy.)
export interface SettingDoc {
  de: { name: string; desc: string };
  en: { name: string; desc: string };
}

export const SETTINGS_DOCS: SettingDoc[] = [
  {
    de: { name: "Theme (Hell / Dunkel)", desc: "Über „Design“ im Header zwischen hellem und dunklem Modus wechseln. Die Wahl wird lokal gespeichert." },
    en: { name: "Theme (light / dark)", desc: "Switch between light and dark mode via “Design” in the header. The choice is stored locally." },
  },
  {
    de: { name: "Akzentfarbe", desc: "Im Design-Popover eine Akzentfarbe aus der Palette wählen (Blau, Cyan, Grün, Violett, Pink, Amber) — färbt Diagramme und Bedienelemente." },
    en: { name: "Accent colour", desc: "Pick an accent from the palette in the Design popover (blue, cyan, green, violet, pink, amber) — it tints charts and controls." },
  },
  {
    de: { name: "Sprache (DE / EN)", desc: "Der Sprachumschalter im Header stellt die gesamte Oberfläche auf Deutsch oder Englisch um." },
    en: { name: "Language (DE / EN)", desc: "The language toggle in the header switches the whole UI between German and English." },
  },
  {
    de: { name: "Globale Suche", desc: "Das Suchfeld filtert query-fähige Widgets (z. B. Kanban, Prompt-Verlauf) und durchsucht Prompts/Tool-Ziele live." },
    en: { name: "Global search", desc: "The search box filters query-aware widgets (e.g. kanban, prompt history) and searches prompts/tool targets live." },
  },
  {
    de: { name: "Zeitraum", desc: "Der Zeitraum-Wähler grenzt zeitbasierte Widgets ein (z. B. 24 h / 7 T / 30 T)." },
    en: { name: "Time range", desc: "The time-range picker scopes time-based widgets (e.g. 24h / 7d / 30d)." },
  },
  {
    de: { name: "Facetten-Filter", desc: "Filtere das Dashboard nach Projekt, Modell oder Status — die Facetten-Leiste wirkt auf alle passenden Widgets." },
    en: { name: "Facet filters", desc: "Filter the dashboard by project, model or status — the facet bar applies across all matching widgets." },
  },
  {
    de: { name: "Ansichten (Views)", desc: "Eigene Layout-Zusammenstellungen als benannte Views speichern und schnell umschalten." },
    en: { name: "Views", desc: "Save custom layout arrangements as named views and switch between them quickly." },
  },
  {
    de: { name: "Benachrichtigungen", desc: "Das Glocken-Menü sammelt Hinweise (z. B. Berechtigungs-Anfragen, Alerts)." },
    en: { name: "Notifications", desc: "The bell menu collects notices (e.g. permission requests, alerts)." },
  },
  {
    de: { name: "Info-Hinweise", desc: "Jedes Panel hat ein ℹ️-Tooltip, das kurz erklärt, was es zeigt und woher die Daten kommen." },
    en: { name: "Info hints", desc: "Every panel has an ℹ️ tooltip explaining what it shows and where the data comes from." },
  },
  {
    de: { name: "Layout: Größe ändern", desc: "Beim Hovern eines Widgets Breite/Höhe über die Toolbar anpassen — das Layout wird lokal gespeichert." },
    en: { name: "Layout: resize", desc: "Hover a widget to adjust its width/height from the toolbar — the layout is saved locally." },
  },
  {
    de: { name: "Layout zurücksetzen", desc: "Sobald das Layout vom Standard abweicht, erscheint „Layout zurücksetzen“, das die Vorgabe wiederherstellt." },
    en: { name: "Reset layout", desc: "Once the layout differs from the default, a “Reset layout” action appears to restore it." },
  },
  {
    de: { name: "Widget-Galerie (ein-/ausblenden)", desc: "Über die Galerie einzelne Widgets aus- oder wieder einblenden, um das Dashboard zu personalisieren." },
    en: { name: "Widget gallery (show/hide)", desc: "Use the gallery to hide or re-show individual widgets and personalise the dashboard." },
  },
  {
    de: { name: "Widget-Einstellungen", desc: "Manche Widgets haben eigene Optionen (z. B. das Limit des Live-Streams) in ihrer Einstellungs-Schublade — persistiert über /api/plugins/config." },
    en: { name: "Per-widget settings", desc: "Some widgets have their own options (e.g. the Live Stream limit) in a settings drawer — persisted via /api/plugins/config." },
  },
];
