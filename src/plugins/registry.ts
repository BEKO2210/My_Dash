import type { ComponentType } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Boxes,
  CalendarClock,
  CalendarRange,
  Clock,
  Coins,
  FileText,
  Flame,
  Fuel,
  Gauge,
  GitBranch,
  GitPullRequest,
  Hash,
  Hourglass,
  KanbanSquare,
  Layers,
  LayoutDashboard,
  MessageSquare,
  PieChart,
  Plug,
  Radio,
  ShieldAlert,
  ShieldCheck,
  Timer,
  TrendingUp,
  Trophy,
  Waypoints,
  type LucideIcon,
} from "lucide-react";
import { LiveStream } from "./live-stream/widget";
import { Kanban } from "./kanban/widget";
import { TokenChart, TOKEN_CHART_VIEWS } from "./token-chart/widget";
import { ToolGraph } from "./tool-graph/widget";
import { BudgetGauge } from "./budget-gauge/widget";
import { KpiBar } from "./kpi-bar/widget";
import { Heatmap } from "./heatmap/widget";
import { ToolFrequency, TOOL_FREQ_VIEWS } from "./tool-frequency/widget";
import { FileHotspots } from "./file-hotspots/widget";
import { SessionTimeline } from "./session-timeline/widget";
import { Latency } from "./latency/widget";
import { ErrorRate } from "./error-rate/widget";
import { ModelDonut, MODEL_DONUT_VIEWS } from "./model-donut/widget";
import { SankeyFlow } from "./sankey-flow/widget";
import { ProjectLeaderboard } from "./project-leaderboard/widget";
import { LiveNow } from "./live-now/widget";
import { PromptHistory } from "./prompt-history/widget";
import { Streak } from "./streak/widget";
import { SubagentTree } from "./subagent-tree/widget";
import { McpServers } from "./mcp-servers/widget";
import { CompactionTimeline } from "./compaction-timeline/widget";
import { TagCloud } from "./tag-cloud/widget";
import { TokenBurn } from "./token-burn/widget";
import { CalendarHeatmap } from "./calendar-heatmap/widget";
import { Velocity } from "./velocity/widget";
import { SessionDuration } from "./session-duration/widget";
import { Reliability } from "./reliability/widget";
import { Incidents } from "./incidents/widget";
import { Anomaly } from "./anomaly/widget";
import { GitCorrelation } from "./git-correlation/widget";
import { externalWidgets } from "./external.generated";

// ─────────────────────────────────────────────────────────────────────────────
// PLUGIN REGISTRY
// Add a feature in three steps:
//   1. create  src/plugins/<your-plugin>/widget.tsx  exporting a React component
//   2. (optional) add a read-only route under  src/app/api/<your-plugin>/route.ts
//   3. register it below with its manifest — the dashboard grid renders it
//      automatically and the gallery groups it by category.
// Nothing else needs to change. This is the seam for future third-party plugins.
// ─────────────────────────────────────────────────────────────────────────────

export type WidgetCategory =
  | "overview"
  | "sessions"
  | "economy"
  | "activity"
  | "tools"
  | "quality";

// Declarative per-widget settings, rendered by the settings drawer and persisted
// via /api/plugins/config. `label` is an i18n key.
export type PluginSetting =
  | { key: string; type: "boolean"; label: string; default: boolean }
  | { key: string; type: "number"; label: string; default: number; min?: number; max?: number }
  | { key: string; type: "select"; label: string; default: string; options: { value: string; label: string }[] };

export interface Widget {
  id: string;
  /** Legacy literal name — fallback for external widgets that ship without a titleKey. */
  title: string;
  /** i18n key for the localized display name (gallery, command palette, settings, error boundary). */
  titleKey?: string;
  /** Tailwind grid-column span on the 6-col desktop grid (also the default size). */
  span: string;
  /** Tailwind row-height utility for the panel (also the default size). */
  height: string;
  /** Manifest metadata — icon, grouping category and an i18n description key. */
  icon: LucideIcon;
  category: WidgetCategory;
  /** i18n key for a short description (reuses each widget's existing info copy). */
  description: string;
  /** Optional declarative settings for the per-widget settings drawer. */
  settings?: PluginSetting[];
  component: ComponentType;
}

// Standard panel height (most widgets). KPI bar + calendar use h-auto.
const H = "h-[360px] min-[2560px]:h-[480px] min-[3840px]:h-[660px]";
const H_TALL = "h-[420px] min-[2560px]:h-[560px] min-[3840px]:h-[760px]";

export const widgets: Widget[] = [
  { id: "kpi-bar", title: "Übersicht", titleKey: "kpi.title", span: "lg:col-span-6", height: "h-auto", icon: LayoutDashboard, category: "overview", description: "kpi.info", component: KpiBar },
  { id: "kanban", title: "Sessions", titleKey: "kanban.title", span: "lg:col-span-4", height: H_TALL, icon: KanbanSquare, category: "sessions", description: "kanban.info", component: Kanban },
  { id: "live-stream", title: "Live Stream", titleKey: "stream.title", span: "lg:col-span-2", height: H_TALL, icon: Activity, category: "sessions", description: "stream.info", settings: [{ key: "limit", type: "number", label: "stream.setLimit", default: 100, min: 10, max: 300 }], component: LiveStream },
  { id: "token-chart", title: "Tokens & Kosten", titleKey: "tokens.title", span: "lg:col-span-3", height: H, icon: Coins, category: "economy", description: "tokens.info", settings: [viewSetting(TOKEN_CHART_VIEWS)], component: TokenChart },
  { id: "tool-graph", title: "Tool-Graph (3D)", titleKey: "graph.title", span: "lg:col-span-3", height: H, icon: Boxes, category: "tools", description: "graph.info", component: ToolGraph },
  { id: "budget-gauge", title: "Budget", titleKey: "budget.title", span: "lg:col-span-2", height: H, icon: Gauge, category: "economy", description: "budget.info", component: BudgetGauge },
  { id: "heatmap", title: "Aktivität", titleKey: "heatmap.title", span: "lg:col-span-4", height: H, icon: CalendarClock, category: "activity", description: "heatmap.info", component: Heatmap },
  { id: "tool-frequency", title: "Top-Tools", titleKey: "tools.title", span: "lg:col-span-2", height: H, icon: BarChart3, category: "tools", description: "tools.info", settings: [viewSetting(TOOL_FREQ_VIEWS)], component: ToolFrequency },
  { id: "file-hotspots", title: "Datei-Hotspots", titleKey: "files.title", span: "lg:col-span-3", height: H, icon: FileText, category: "tools", description: "files.info", component: FileHotspots },
  { id: "session-timeline", title: "Session-Timeline", titleKey: "timeline.title", span: "lg:col-span-3", height: H, icon: Clock, category: "sessions", description: "timeline.info", component: SessionTimeline },
  { id: "latency", title: "Tool-Latenz", titleKey: "latency.title", span: "lg:col-span-3", height: H, icon: Timer, category: "quality", description: "latency.info", component: Latency },
  { id: "error-rate", title: "Fehlerrate", titleKey: "errors.title", span: "lg:col-span-3", height: H, icon: ShieldAlert, category: "quality", description: "errors.info", component: ErrorRate },
  { id: "model-donut", title: "Modelle", titleKey: "donut.title", span: "lg:col-span-3", height: H, icon: PieChart, category: "economy", description: "donut.info", settings: [viewSetting(MODEL_DONUT_VIEWS)], component: ModelDonut },
  { id: "sankey-flow", title: "Fluss", titleKey: "sankey.title", span: "lg:col-span-3", height: H, icon: Waypoints, category: "tools", description: "sankey.info", component: SankeyFlow },
  { id: "project-leaderboard", title: "Projekt-Rangliste", titleKey: "leaderboard.title", span: "lg:col-span-3", height: H, icon: Trophy, category: "economy", description: "leaderboard.info", component: ProjectLeaderboard },
  { id: "live-now", title: "Jetzt live", titleKey: "now.title", span: "lg:col-span-3", height: H, icon: Radio, category: "sessions", description: "now.info", component: LiveNow },
  { id: "prompt-history", title: "Prompt-Verlauf", titleKey: "prompts.title", span: "lg:col-span-3", height: H, icon: MessageSquare, category: "sessions", description: "prompts.info", component: PromptHistory },
  { id: "streak", title: "Streak & Produktivität", titleKey: "streak.title", span: "lg:col-span-3", height: H, icon: Flame, category: "activity", description: "streak.info", component: Streak },
  { id: "subagent-tree", title: "Subagent-Baum", titleKey: "subagents.title", span: "lg:col-span-3", height: H, icon: GitBranch, category: "sessions", description: "subagents.info", component: SubagentTree },
  { id: "mcp-servers", title: "MCP-Server", titleKey: "mcp.title", span: "lg:col-span-3", height: H, icon: Plug, category: "tools", description: "mcp.info", component: McpServers },
  { id: "compaction-timeline", title: "Kompaktierungen", titleKey: "compaction.title", span: "lg:col-span-3", height: H, icon: Layers, category: "quality", description: "compaction.info", component: CompactionTimeline },
  { id: "tag-cloud", title: "Themen-Cloud", titleKey: "tags.title", span: "lg:col-span-3", height: H, icon: Hash, category: "tools", description: "tags.info", component: TagCloud },
  { id: "token-burn", title: "Token-Verbrauch je Tool", titleKey: "burn.title", span: "lg:col-span-3", height: H, icon: Fuel, category: "economy", description: "burn.info", component: TokenBurn },
  { id: "calendar-heatmap", title: "Jahres-Kalender", titleKey: "calendar.title", span: "lg:col-span-6", height: "h-auto", icon: CalendarRange, category: "activity", description: "calendar.info", component: CalendarHeatmap },
  { id: "velocity", title: "Geschwindigkeits-Trend", titleKey: "velocity.title", span: "lg:col-span-3", height: H, icon: TrendingUp, category: "activity", description: "velocity.info", component: Velocity },
  { id: "session-duration", title: "Session-Dauer", titleKey: "sessionDur.title", span: "lg:col-span-3", height: H, icon: Hourglass, category: "sessions", description: "sessionDur.info", component: SessionDuration },
  { id: "reliability", title: "Zuverlässigkeit je Projekt", titleKey: "reliability.title", span: "lg:col-span-3", height: H, icon: ShieldCheck, category: "quality", description: "reliability.info", component: Reliability },
  { id: "incidents", title: "Was lief schief", titleKey: "incidents.title", span: "lg:col-span-3", height: H, icon: AlertTriangle, category: "quality", description: "incidents.info", component: Incidents },
  { id: "anomaly", title: "Anomalie-Erkennung", titleKey: "anomaly.title", span: "lg:col-span-3", height: H, icon: Activity, category: "quality", description: "anomaly.info", component: Anomaly },
  { id: "git-correlation", title: "Branches & PRs", titleKey: "gitcorr.title", span: "lg:col-span-3", height: H, icon: GitPullRequest, category: "sessions", description: "gitcorr.info", component: GitCorrelation },
  // Third-party widgets dropped into plugins.local/ (scanned at build).
  ...externalWidgets,
];

/**
 * Localized display name for a widget — used by the gallery, command palette,
 * settings drawer and error boundary so widget names follow the active language.
 * Falls back to the literal `title` for external widgets that ship without a
 * `titleKey`.
 */
export function widgetTitle(w: Widget, t: (key: string) => string): string {
  return w.titleKey ? t(w.titleKey) : w.title;
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase F — per-widget VIEW VARIANTS
// A widget can offer 2–3 switchable views via a standard "view" setting (a plain
// `select`, so it renders in the settings drawer and persists in plugin_config —
// no new write path). The DEFAULT value MUST equal the widget's current look.
// ─────────────────────────────────────────────────────────────────────────────

/** A selectable view value (e.g. "chart", "table"). */
export type ViewVariant = string;
/** One view option: its value + an i18n key for its label. */
export interface ViewOption {
  value: ViewVariant;
  label: string;
}

/** Build the standard `view` manifest setting. First option is the default look. */
export function viewSetting(options: ViewOption[], def: ViewVariant = options[0]?.value ?? ""): PluginSetting {
  return { key: "view", type: "select", label: "view.label", default: def, options };
}

/**
 * Resolve a persisted view value to a known option, falling back to the default.
 * Pure + defensive: an unknown/legacy/corrupt stored value can never break render.
 */
export function resolveView<T extends ViewVariant>(stored: unknown, options: readonly T[], def: T): T {
  return typeof stored === "string" && (options as readonly string[]).includes(stored) ? (stored as T) : def;
}
