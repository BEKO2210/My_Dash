import type { ComponentType } from "react";
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

// ─────────────────────────────────────────────────────────────────────────────
// PLUGIN REGISTRY
// Add a feature in three steps:
//   1. create  src/plugins/<your-plugin>/widget.tsx  exporting a React component
//   2. (optional) add a read-only route under  src/app/api/<your-plugin>/route.ts
//   3. register it below — the dashboard grid renders it automatically.
// Nothing else needs to change. This is the seam for the future Obsidian
// knowledge-graph / semantic-search plugins.
// ─────────────────────────────────────────────────────────────────────────────

export interface Widget {
  id: string;
  title: string;
  /** Tailwind grid-column span on the 6-col desktop grid. */
  span: string;
  /** Tailwind row-height utility for the panel. */
  height: string;
  component: ComponentType;
}

export const widgets: Widget[] = [
  {
    id: "kpi-bar",
    title: "Übersicht",
    span: "lg:col-span-6",
    height: "h-auto",
    component: KpiBar,
  },
  {
    id: "kanban",
    title: "Sessions",
    span: "lg:col-span-4",
    height: "h-[420px] min-[2560px]:h-[560px] min-[3840px]:h-[760px]",
    component: Kanban,
  },
  {
    id: "live-stream",
    title: "Live Stream",
    span: "lg:col-span-2",
    height: "h-[420px] min-[2560px]:h-[560px] min-[3840px]:h-[760px]",
    component: LiveStream,
  },
  {
    id: "token-chart",
    title: "Tokens & Kosten",
    span: "lg:col-span-3",
    height: "h-[360px] min-[2560px]:h-[480px] min-[3840px]:h-[660px]",
    component: TokenChart,
  },
  {
    id: "tool-graph",
    title: "Tool-Graph (3D)",
    span: "lg:col-span-3",
    height: "h-[360px] min-[2560px]:h-[480px] min-[3840px]:h-[660px]",
    component: ToolGraph,
  },
  {
    id: "budget-gauge",
    title: "Budget",
    span: "lg:col-span-2",
    height: "h-[360px] min-[2560px]:h-[480px] min-[3840px]:h-[660px]",
    component: BudgetGauge,
  },
  {
    id: "heatmap",
    title: "Aktivität",
    span: "lg:col-span-4",
    height: "h-[360px] min-[2560px]:h-[480px] min-[3840px]:h-[660px]",
    component: Heatmap,
  },
  {
    id: "tool-frequency",
    title: "Top-Tools",
    span: "lg:col-span-2",
    height: "h-[360px] min-[2560px]:h-[480px] min-[3840px]:h-[660px]",
    component: ToolFrequency,
  },
  {
    id: "file-hotspots",
    title: "Datei-Hotspots",
    span: "lg:col-span-3",
    height: "h-[360px] min-[2560px]:h-[480px] min-[3840px]:h-[660px]",
    component: FileHotspots,
  },
  {
    id: "session-timeline",
    title: "Session-Timeline",
    span: "lg:col-span-3",
    height: "h-[360px] min-[2560px]:h-[480px] min-[3840px]:h-[660px]",
    component: SessionTimeline,
  },
  {
    id: "latency",
    title: "Tool-Latenz",
    span: "lg:col-span-3",
    height: "h-[360px] min-[2560px]:h-[480px] min-[3840px]:h-[660px]",
    component: Latency,
  },
  {
    id: "error-rate",
    title: "Fehlerrate",
    span: "lg:col-span-3",
    height: "h-[360px] min-[2560px]:h-[480px] min-[3840px]:h-[660px]",
    component: ErrorRate,
  },
  {
    id: "model-donut",
    title: "Modelle",
    span: "lg:col-span-3",
    height: "h-[360px] min-[2560px]:h-[480px] min-[3840px]:h-[660px]",
    component: ModelDonut,
  },
  {
    id: "sankey-flow",
    title: "Fluss",
    span: "lg:col-span-3",
    height: "h-[360px] min-[2560px]:h-[480px] min-[3840px]:h-[660px]",
    component: SankeyFlow,
  },
  {
    id: "project-leaderboard",
    title: "Projekt-Rangliste",
    span: "lg:col-span-3",
    height: "h-[360px] min-[2560px]:h-[480px] min-[3840px]:h-[660px]",
    component: ProjectLeaderboard,
  },
  {
    id: "live-now",
    title: "Jetzt live",
    span: "lg:col-span-3",
    height: "h-[360px] min-[2560px]:h-[480px] min-[3840px]:h-[660px]",
    component: LiveNow,
  },
  {
    id: "prompt-history",
    title: "Prompt-Verlauf",
    span: "lg:col-span-3",
    height: "h-[360px] min-[2560px]:h-[480px] min-[3840px]:h-[660px]",
    component: PromptHistory,
  },
  {
    id: "streak",
    title: "Streak & Produktivität",
    span: "lg:col-span-3",
    height: "h-[360px] min-[2560px]:h-[480px] min-[3840px]:h-[660px]",
    component: Streak,
  },
  {
    id: "subagent-tree",
    title: "Subagent-Baum",
    span: "lg:col-span-3",
    height: "h-[360px] min-[2560px]:h-[480px] min-[3840px]:h-[660px]",
    component: SubagentTree,
  },
  {
    id: "mcp-servers",
    title: "MCP-Server",
    span: "lg:col-span-3",
    height: "h-[360px] min-[2560px]:h-[480px] min-[3840px]:h-[660px]",
    component: McpServers,
  },
  {
    id: "compaction-timeline",
    title: "Kompaktierungen",
    span: "lg:col-span-3",
    height: "h-[360px] min-[2560px]:h-[480px] min-[3840px]:h-[660px]",
    component: CompactionTimeline,
  },
  {
    id: "tag-cloud",
    title: "Themen-Cloud",
    span: "lg:col-span-3",
    height: "h-[360px] min-[2560px]:h-[480px] min-[3840px]:h-[660px]",
    component: TagCloud,
  },
  {
    id: "token-burn",
    title: "Token-Verbrauch je Tool",
    span: "lg:col-span-3",
    height: "h-[360px] min-[2560px]:h-[480px] min-[3840px]:h-[660px]",
    component: TokenBurn,
  },
  {
    id: "calendar-heatmap",
    title: "Jahres-Kalender",
    span: "lg:col-span-6",
    height: "h-auto",
    component: CalendarHeatmap,
  },
  {
    id: "velocity",
    title: "Geschwindigkeits-Trend",
    span: "lg:col-span-3",
    height: "h-[360px] min-[2560px]:h-[480px] min-[3840px]:h-[660px]",
    component: Velocity,
  },
  {
    id: "session-duration",
    title: "Session-Dauer",
    span: "lg:col-span-3",
    height: "h-[360px] min-[2560px]:h-[480px] min-[3840px]:h-[660px]",
    component: SessionDuration,
  },
  {
    id: "reliability",
    title: "Zuverlässigkeit je Projekt",
    span: "lg:col-span-3",
    height: "h-[360px] min-[2560px]:h-[480px] min-[3840px]:h-[660px]",
    component: Reliability,
  },
];
