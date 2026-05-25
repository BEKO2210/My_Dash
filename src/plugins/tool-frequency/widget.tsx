"use client";

import { useEffect, useState } from "react";
import { Hammer } from "lucide-react";
import { Panel } from "@/components/panel";
import { WidgetState } from "@/components/widget-state";
import { usePluginQuery } from "@/components/plugin-data";
import { viewState } from "@/components/widget-view";
import { useView, ViewSwitch } from "@/components/view-variant";
import type { ViewOption } from "@/plugins/registry";
import { useT } from "@/lib/i18n";
import { formatCompact } from "@/lib/format";
import { parseMcpTool } from "@/lib/mcp";

interface ToolStat {
  tool: string;
  count: number;
  failures: number;
  source: string | null;
  mcpServer: string | null;
  avgDurationMs: number | null;
}

type Range = "7" | "30" | "0";
const RANGES: Range[] = ["7", "30", "0"];
const RANGE_LABEL: Record<Range, string> = {
  "7": "tools.range7d",
  "30": "tools.range30d",
  "0": "tools.rangeAll",
};

// Phase F: this widget is the reference implementation for view variants.
// `bars` is the original look (default); `table` is a denser numeric alternative.
const WIDGET_ID = "tool-frequency";
const VIEW_VALUES = ["bars", "table"] as const;
export const TOOL_FREQ_VIEWS: ViewOption[] = [
  { value: "bars", label: "view.bars" },
  { value: "table", label: "view.table" },
];

function label(t: ToolStat): string {
  if (t.source === "mcp") {
    const m = parseMcpTool(t.tool);
    return m.server ? `${m.server} / ${m.tool ?? ""}` : t.tool;
  }
  return t.tool;
}

const dotClass = (source: string | null) => (source === "mcp" ? "bg-violet-400" : "bg-accent");

export function ToolFrequency() {
  const { t } = useT();
  const [range, setRange] = useState<Range>("30");
  const [grown, setGrown] = useState(false);
  const view = useView(WIDGET_ID, VIEW_VALUES, "bars");
  const q = usePluginQuery<{ tools: ToolStat[] }>(`/api/tools?days=${range}&limit=12`, { pollMs: 30_000 });

  // Grow the bars from 0 once data has painted (bars view only).
  useEffect(() => {
    if (!q.data) return;
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setGrown(true)));
    return () => cancelAnimationFrame(id);
  }, [q.data]);

  const tools = q.data?.tools ?? [];
  const max = Math.max(1, ...tools.map((x) => x.count));
  const vs = viewState(q, () => tools.length === 0);

  return (
    <Panel
      title={t("tools.title")}
      icon={<Hammer className="h-4 w-4 text-accent" />}
      info={t("tools.info")}
      right={
        <div className="flex items-center gap-1.5">
          <div className="flex rounded-md border border-panel-border text-xs">
            {RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                aria-pressed={range === r}
                className={`px-2 py-1 ${range === r ? "bg-accent/20 text-accent" : "text-muted hover:text-foreground"}`}
              >
                {t(RANGE_LABEL[r])}
              </button>
            ))}
          </div>
          <ViewSwitch widgetId={WIDGET_ID} options={TOOL_FREQ_VIEWS} value={view} t={t} />
        </div>
      }
    >
      {vs === "error" ? (
        <WidgetState icon={Hammer} title={t("common.loadError")} onRetry={q.refetch} retryLabel={t("common.retry")} />
      ) : vs === "loading" ? (
        <WidgetState icon={Hammer} title={t("common.loading")} loading />
      ) : vs === "empty" ? (
        <WidgetState icon={Hammer} title={t("tools.empty")} />
      ) : view === "table" ? (
        <ToolTable tools={tools} t={t} />
      ) : (
        <ToolBars tools={tools} max={max} grown={grown} />
      )}
    </Panel>
  );
}

function ToolBars({ tools, max, grown }: { tools: ToolStat[]; max: number; grown: boolean }) {
  return (
    <ul tabIndex={0} className="flex h-full flex-col justify-center gap-2 overflow-auto p-4 outline-none">
      {tools.map((tool) => (
        <li key={tool.tool} title={tool.avgDurationMs != null ? `⌀ ${tool.avgDurationMs} ms` : undefined}>
          <div className="mb-1 flex items-center justify-between gap-2 text-xs">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className={`h-2 w-2 shrink-0 rounded-full ${dotClass(tool.source)}`} />
              <span className="truncate text-foreground">{label(tool)}</span>
            </span>
            <span className="shrink-0 tabular-nums text-muted">
              {formatCompact(tool.count)}
              {tool.failures > 0 && <span className="ml-1 text-red-400">·{tool.failures}✗</span>}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-background/70">
            <div
              className={`h-full rounded-full transition-[width] duration-700 ease-out ${tool.source === "mcp" ? "bg-violet-500" : "bg-accent"}`}
              style={{ width: grown ? `${(tool.count / max) * 100}%` : "0%" }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function ToolTable({ tools, t }: { tools: ToolStat[]; t: (k: string) => string }) {
  return (
    <div tabIndex={0} className="h-full overflow-auto outline-none">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-panel/95 text-muted backdrop-blur">
          <tr>
            <th className="px-3 py-2 text-left font-medium">{t("tools.colTool")}</th>
            <th className="px-2 py-2 text-right font-medium">{t("tools.colCount")}</th>
            <th className="px-2 py-2 text-right font-medium">{t("tools.colFails")}</th>
            <th className="px-3 py-2 text-right font-medium">{t("tools.colAvg")}</th>
          </tr>
        </thead>
        <tbody>
          {tools.map((tool) => (
            <tr key={tool.tool} className="border-t border-panel-border/50 transition-colors hover:bg-white/[0.03]">
              <td className="max-w-[12rem] truncate px-3 py-1.5 text-foreground">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${dotClass(tool.source)}`} />
                  <span className="truncate">{label(tool)}</span>
                </span>
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums text-foreground">{formatCompact(tool.count)}</td>
              <td className={`px-2 py-1.5 text-right tabular-nums ${tool.failures > 0 ? "text-red-400" : "text-muted"}`}>
                {tool.failures}
              </td>
              <td className="px-3 py-1.5 text-right tabular-nums text-muted">
                {tool.avgDurationMs != null ? tool.avgDurationMs : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
