"use client";

import { useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, Tooltip, Treemap } from "recharts";
import { FileCode2 } from "lucide-react";
import { Panel } from "@/components/panel";
import { WidgetState } from "@/components/widget-state";
import { useLive } from "@/components/live-provider";
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

function FileCell({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  name = "",
  value = 0,
  max = 1,
}: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string;
  value?: number;
  max?: number;
}) {
  const intensity = max > 0 ? value / max : 0;
  const fill = `rgba(79,140,255,${0.22 + 0.68 * intensity})`;
  const showLabel = width > 56 && height > 18;
  return (
    <g>
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
  const { tick } = useLive();
  const [range, setRange] = useState<Range>("30");
  const [files, setFiles] = useState<FileHotspot[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch(`/api/files?days=${range}&limit=60`)
        .then((r) => r.json())
        .then((d: { files: FileHotspot[] }) => {
          if (!cancelled) setFiles(d.files);
        })
        .catch(() => {});
    load();
    const poll = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, [range, tick]);

  const data = useMemo(() => (files ?? []).map((f) => ({ ...f, size: Math.max(1, f.churn) })), [files]);
  const max = useMemo(() => Math.max(1, ...data.map((d) => d.size)), [data]);

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
              className={`px-2 py-1 ${range === r ? "bg-accent/20 text-accent" : "text-muted hover:text-foreground"}`}
            >
              {t(RANGE_LABEL[r])}
            </button>
          ))}
        </div>
      }
    >
      {!files ? (
        <WidgetState icon={FileCode2} title={t("common.loading")} loading />
      ) : data.length === 0 ? (
        <WidgetState icon={FileCode2} title={t("files.empty")} />
      ) : (
        <div className="h-full w-full p-2">
          <ResponsiveContainer width="100%" height="100%">
            <Treemap data={data} dataKey="size" stroke="#0e1219" content={<FileCell max={max} />}>
              <Tooltip content={<HotspotTooltip />} />
            </Treemap>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}
