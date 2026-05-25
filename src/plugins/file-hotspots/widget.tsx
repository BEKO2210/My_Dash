"use client";

import { useMemo, useState } from "react";
import { ResponsiveContainer, Tooltip, Treemap } from "recharts";
import { FileCode2 } from "lucide-react";
import { Panel } from "@/components/panel";
import { WidgetState } from "@/components/widget-state";
import { usePluginQuery } from "@/components/plugin-data";
import { viewState } from "@/components/widget-view";
import { useSearch } from "@/components/search";
import { useT } from "@/lib/i18n";
import type { FileHotspot } from "@/lib/files";

type Range = "7" | "30" | "0";
const RANGES: Range[] = ["7", "30", "0"];
const RANGE_LABEL: Record<Range, string> = {
  "7": "tools.range7d",
  "30": "tools.range30d",
  "0": "tools.rangeAll",
};

function clip(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

// Solid tile colour: the accent blue pre-blended over the dark chart base by
// intensity. A semi-transparent blue would blend over the panel, turning pale and
// unreadable on the light theme's white panel; this keeps the treemap dark-on-dark
// in both themes (identical to the old look on the dark panel #0e1219).
function heatFill(intensity: number): string {
  const a = 0.22 + 0.68 * Math.max(0, Math.min(1, intensity));
  const mix = (c: number, base: number) => Math.round(c * a + base * (1 - a));
  return `rgb(${mix(79, 14)}, ${mix(140, 18)}, ${mix(255, 25)})`;
}

function FileCell({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  name = "",
  value = 0,
  max = 1,
  onPick,
}: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string;
  value?: number;
  max?: number;
  onPick?: (name: string) => void;
}) {
  const intensity = max > 0 ? value / max : 0;
  const fill = heatFill(intensity);
  const showLabel = width > 56 && height > 18;
  const clickable = !!onPick && !!name;
  return (
    <g
      onClick={clickable ? () => onPick!(name) : undefined}
      style={clickable ? { cursor: "pointer" } : undefined}
    >
      <rect x={x} y={y} width={width} height={height} fill={fill} stroke="#0e1219" strokeWidth={1} rx={2} />
      {showLabel && (
        <text x={x + 5} y={y + 14} fill="#e5e7eb" fontSize={11}>
          {clip(name, Math.max(3, Math.floor(width / 7)))}
        </text>
      )}
      {showLabel && height > 32 && (
        <text x={x + 5} y={y + 28} fill="#aab3c5" fontSize={10}>
          {value}
        </text>
      )}
    </g>
  );
}

function HotspotTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: FileHotspot }[];
}) {
  const { t } = useT();
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-md border border-panel-border bg-[#0e1219] px-2.5 py-1.5 text-xs shadow-lg">
      <div className="max-w-xs truncate font-mono text-foreground">{d.path}</div>
      <div className="text-muted">
        {d.edits}× {t("files.edits")} · <span className="text-emerald-400">+{d.added}</span>{" "}
        <span className="text-red-400">−{d.removed}</span>
      </div>
    </div>
  );
}

export function FileHotspots() {
  const { t } = useT();
  const { setQuery } = useSearch();
  const [range, setRange] = useState<Range>("30");
  const q = usePluginQuery<{ files: FileHotspot[] }>(`/api/files?days=${range}&limit=60`, { pollMs: 30_000 });

  const data = useMemo(() => (q.data?.files ?? []).map((f) => ({ ...f, size: Math.max(1, f.churn) })), [q.data]);
  const max = useMemo(() => Math.max(1, ...data.map((d) => d.size)), [data]);
  const vs = viewState(q, () => data.length === 0);

  return (
    <Panel
      title={t("files.title")}
      icon={<FileCode2 className="h-4 w-4 text-accent" />}
      info={t("files.info")}
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
      {vs === "error" ? (
        <WidgetState icon={FileCode2} title={t("common.loadError")} onRetry={q.refetch} retryLabel={t("common.retry")} />
      ) : vs === "loading" ? (
        <WidgetState icon={FileCode2} title={t("common.loading")} loading />
      ) : vs === "empty" ? (
        <WidgetState icon={FileCode2} title={t("files.empty")} />
      ) : (
        <div className="h-full w-full p-2">
          <ResponsiveContainer width="100%" height="100%">
            <Treemap data={data} dataKey="size" stroke="#0e1219" content={<FileCell max={max} onPick={setQuery} />}>
              <Tooltip content={<HotspotTooltip />} />
            </Treemap>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}
