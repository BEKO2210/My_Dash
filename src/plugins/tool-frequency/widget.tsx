"use client";

import { useEffect, useState } from "react";
import { Hammer } from "lucide-react";
import { Panel } from "@/components/panel";
import { WidgetState } from "@/components/widget-state";
import { useLive } from "@/components/live-provider";
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

function label(t: ToolStat): string {
  if (t.source === "mcp") {
    const m = parseMcpTool(t.tool);
    return m.server ? `${m.server} / ${m.tool ?? ""}` : t.tool;
  }
  return t.tool;
}

export function ToolFrequency() {
  const { t } = useT();
  const { tick } = useLive();
  const [range, setRange] = useState<Range>("30");
  const [tools, setTools] = useState<ToolStat[] | null>(null);
  const [grown, setGrown] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch(`/api/tools?days=${range}&limit=12`)
        .then((r) => r.json())
        .then((d: { tools: ToolStat[] }) => {
          if (cancelled) return;
          setTools(d.tools);
          requestAnimationFrame(() => requestAnimationFrame(() => setGrown(true)));
        })
        .catch(() => {});
    load();
    const poll = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, [range, tick]);

  const max = Math.max(1, ...(tools ?? []).map((x) => x.count));

  return (
    <Panel
      title={t("tools.title")}
      icon={<Hammer className="h-4 w-4 text-accent" />}
      info={t("tools.info")}
      right={
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
      }
    >
      {!tools ? (
        <WidgetState icon={Hammer} title={t("common.loading")} loading />
      ) : tools.length === 0 ? (
        <WidgetState icon={Hammer} title={t("tools.empty")} />
      ) : (
        <ul tabIndex={0} className="flex h-full flex-col justify-center gap-2 overflow-auto p-4 outline-none">
          {tools.map((tool) => (
            <li key={tool.tool} title={tool.avgDurationMs != null ? `⌀ ${tool.avgDurationMs} ms` : undefined}>
              <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${tool.source === "mcp" ? "bg-violet-400" : "bg-accent"}`}
                  />
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
      )}
    </Panel>
  );
}
