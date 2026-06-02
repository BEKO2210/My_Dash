"use client";

import { useMemo, useState } from "react";
import { ResponsiveContainer, Tooltip, Treemap } from "recharts";
import { FileCode2 } from "lucide-react";
import { Panel } from "@/components/panel";
import { WidgetState } from "@/components/widget-state";
import { usePluginQuery } from "@/components/plugin-data";
import { viewState } from "@/components/widget-view";
import { useView, ViewSwitch } from "@/components/view-variant";
import type { ViewOption } from "@/plugins/registry";
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

// Phase F (F9): treemap (default, today's look) ↔ list (ranked churn rows).
const WIDGET_ID = "file-hotspots";
const VIEW_VALUES = ["treemap", "list"] as const;
export const FILE_HOTSPOTS_VIEWS: ViewOption[] = [
  { value: "treemap", label: "view.treemap" },
  { value: "list", label: "view.list" },
];

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
      {/* A dark stroke painted *behind* the fill (paint-order: stroke) gives every
          label a halo, so it stays legible on both the bright high-churn tiles and
          the dark low-churn ones. pointer-events disabled so it never steals hover. */}
      {showLabel && (
        <text
          x={x + 5}
          y={y + 14}
          fill="#f3f6fb"
          fontSize={11}
          fontWeight={600}
          stroke="#080b12"
          strokeWidth={2.6}
          paintOrder="stroke"
          style={{ pointerEvents: "none" }}
        >
          {clip(name, Math.max(3, Math.floor(width / 7)))}
        </text>
      )}
      {showLabel && height > 32 && (
        <text
          x={x + 5}
          y={y + 28}
          fill="#cdd6e6"
          fontSize={10}
          stroke="#080b12"
          strokeWidth={2.4}
          paintOrder="stroke"
          style={{ pointerEvents: "none" }}
        >
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
    <div className="max-w-[24rem] rounded-md border border-panel-border bg-[#0e1219] px-2.5 py-1.5 text-xs shadow-lg">
      <div className="break-all font-mono text-foreground">{d.path}</div>
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
  const view = useView(WIDGET_ID, VIEW_VALUES, "treemap");
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
          <ViewSwitch widgetId={WIDGET_ID} options={FILE_HOTSPOTS_VIEWS} value={view} t={t} />
        </div>
      }
    >
      {vs === "error" ? (
        <WidgetState icon={FileCode2} title={t("common.loadError")} onRetry={q.refetch} retryLabel={t("common.retry")} />
      ) : vs === "loading" ? (
        <WidgetState icon={FileCode2} title={t("common.loading")} loading />
      ) : vs === "empty" ? (
        <WidgetState icon={FileCode2} title={t("files.empty")} />
      ) : view === "list" ? (
        <FileList files={q.data!.files} max={max} onPick={setQuery} t={t} />
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

// List view: files ranked by churn as clickable rows (bar · path · edits · +/−);
// click sets the search query, same as a treemap tile.
function FileList({
  files,
  max,
  onPick,
  t,
}: {
  files: FileHotspot[];
  max: number;
  onPick: (path: string) => void;
  t: (key: string) => string;
}) {
  const sorted = [...files].sort((a, b) => b.churn - a.churn);
  return (
    <ul tabIndex={0} className="flex h-full flex-col gap-1 overflow-auto p-3 outline-none">
      {sorted.map((f) => (
        <li key={f.path}>
          <button
            type="button"
            onClick={() => onPick(f.path)}
            title={`${f.path} — ${f.edits}× ${t("files.edits")}`}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs transition-colors hover:bg-white/[0.03]"
          >
            <span className="relative h-1.5 w-12 shrink-0 overflow-hidden rounded-full bg-background/70">
              <span
                className="absolute inset-y-0 left-0 rounded-full bg-accent/70"
                style={{ width: `${Math.max(4, (f.churn / max) * 100)}%` }}
              />
            </span>
            <span className="min-w-0 flex-1 truncate font-mono text-foreground">{f.path}</span>
            <span className="shrink-0 tabular-nums text-muted">{f.edits}×</span>
            <span className="shrink-0 tabular-nums text-emerald-400">+{f.added}</span>
            <span className="shrink-0 tabular-nums text-red-400">−{f.removed}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
