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
import { TokenChart } from "./token-chart/widget";
import { ToolGraph } from "./tool-graph/widget";
import { BudgetGauge } from "./budget-gauge/widget";
import { KpiBar } from "./kpi-bar/widget";
import { Heatmap } from "./heatmap/widget";
import { ToolFrequency } from "./tool-frequency/widget";
import { FileHotspots } from "./file-hotspots/widget";
import { SessionTimeline } from "./session-timeline/widget";
import { Latency } from "./latency/widget";
import { ErrorRate } from "./error-rate/widget";
import { ModelDonut } from "./model-donut/widget";
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
  title: string;
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
  { id: "kpi-bar", title: "Übersicht", span: "lg:col-span-6", height: "h-auto", icon: LayoutDashboard, category: "overview", description: "kpi.info", component: KpiBar },
  { id: "kanban", title: "Sessions", span: "lg:col-span-4", height: H_TALL, icon: KanbanSquare, category: "sessions", description: "kanban.info", component: Kanban },
  { id: "live-stream", title: "Live Stream", span: "lg:col-span-2", height: H_TALL, icon: Activity, category: "sessions", description: "stream.info", settings: [{ key: "limit", type: "number", label: "stream.setLimit", default: 100, min: 10, max: 300 }], component: LiveStream },
  { id: "token-chart", title: "Tokens & Kosten", span: "lg:col-span-3", height: H, icon: Coins, category: "economy", description: "tokens.info", component: TokenChart },
  { id: "tool-graph", title: "Tool-Graph (3D)", span: "lg:col-span-3", height: H, icon: Boxes, category: "tools", description: "graph.info", component: ToolGraph },
  { id: "budget-gauge", title: "Budget", span: "lg:col-span-2", height: H, icon: Gauge, category: "economy", description: "budget.info", component: BudgetGauge },
  { id: "heatmap", title: "Aktivität", span: "lg:col-span-4", height: H, icon: CalendarClock, category: "activity", description: "heatmap.info", component: Heatmap },
  { id: "tool-frequency", title: "Top-Tools", span: "lg:col-span-2", height: H, icon: BarChart3, category: "tools", description: "tools.info", component: ToolFrequency },
  { id: "file-hotspots", title: "Datei-Hotspots", span: "lg:col-span-3", height: H, icon: FileText, category: "tools", description: "files.info", component: FileHotspots },
  { id: "session-timeline", title: "Session-Timeline", span: "lg:col-span-3", height: H, icon: Clock, category: "sessions", description: "timeline.info", component: SessionTimeline },
  { id: "latency", title: "Tool-Latenz", span: "lg:col-span-3", height: H, icon: Timer, category: "quality", description: "latency.info", component: Latency },
  { id: "error-rate", title: "Fehlerrate", span: "lg:col-span-3", height: H, icon: ShieldAlert, category: "quality", description: "errors.info", component: ErrorRate },
  { id: "model-donut", title: "Modelle", span: "lg:col-span-3", height: H, icon: PieChart, category: "economy", description: "donut.info", component: ModelDonut },
  { id: "sankey-flow", title: "Fluss", span: "lg:col-span-3", height: H, icon: Waypoints, category: "tools", description: "sankey.info", component: SankeyFlow },
  { id: "project-leaderboard", title: "Projekt-Rangliste", span: "lg:col-span-3", height: H, icon: Trophy, category: "economy", description: "leaderboard.info", component: ProjectLeaderboard },
  { id: "live-now", title: "Jetzt live", span: "lg:col-span-3", height: H, icon: Radio, category: "sessions", description: "now.info", component: LiveNow },
  { id: "prompt-history", title: "Prompt-Verlauf", span: "lg:col-span-3", height: H, icon: MessageSquare, category: "sessions", description: "prompts.info", component: PromptHistory },
  { id: "streak", title: "Streak & Produktivität", span: "lg:col-span-3", height: H, icon: Flame, category: "activity", description: "streak.info", component: Streak },
  { id: "subagent-tree", title: "Subagent-Baum", span: "lg:col-span-3", height: H, icon: GitBranch, category: "sessions", description: "subagents.info", component: SubagentTree },
  { id: "mcp-servers", title: "MCP-Server", span: "lg:col-span-3", height: H, icon: Plug, category: "tools", description: "mcp.info", component: McpServers },
  { id: "compaction-timeline", title: "Kompaktierungen", span: "lg:col-span-3", height: H, icon: Layers, category: "quality", description: "compaction.info", component: CompactionTimeline },
  { id: "tag-cloud", title: "Themen-Cloud", span: "lg:col-span-3", height: H, icon: Hash, category: "tools", description: "tags.info", component: TagCloud },
  { id: "token-burn", title: "Token-Verbrauch je Tool", span: "lg:col-span-3", height: H, icon: Fuel, category: "economy", description: "burn.info", component: TokenBurn },
  { id: "calendar-heatmap", title: "Jahres-Kalender", span: "lg:col-span-6", height: "h-auto", icon: CalendarRange, category: "activity", description: "calendar.info", component: CalendarHeatmap },
  { id: "velocity", title: "Geschwindigkeits-Trend", span: "lg:col-span-3", height: H, icon: TrendingUp, category: "activity", description: "velocity.info", component: Velocity },
  { id: "session-duration", title: "Session-Dauer", span: "lg:col-span-3", height: H, icon: Hourglass, category: "sessions", description: "sessionDur.info", component: SessionDuration },
  { id: "reliability", title: "Zuverlässigkeit je Projekt", span: "lg:col-span-3", height: H, icon: ShieldCheck, category: "quality", description: "reliability.info", component: Reliability },
  { id: "incidents", title: "Was lief schief", span: "lg:col-span-3", height: H, icon: AlertTriangle, category: "quality", description: "incidents.info", component: Incidents },
  // Third-party widgets dropped into plugins.local/ (scanned at build).
  ...externalWidgets,
];
