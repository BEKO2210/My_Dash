import type { ComponentType } from "react";
import { LiveStream } from "./live-stream/widget";
import { Kanban } from "./kanban/widget";
import { TokenChart } from "./token-chart/widget";
import { ToolGraph } from "./tool-graph/widget";
import { BudgetGauge } from "./budget-gauge/widget";
import { KpiBar } from "./kpi-bar/widget";
import { Heatmap } from "./heatmap/widget";

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
];
