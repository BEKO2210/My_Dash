"use client";

import { useEffect, useState } from "react";
import { ResponsiveContainer, Sankey, Tooltip } from "recharts";
import { Workflow } from "lucide-react";
import { Panel } from "@/components/panel";
import { WidgetState } from "@/components/widget-state";
import { useLive } from "@/components/live-provider";
import { useT } from "@/lib/i18n";
import type { SankeyData } from "@/lib/sankey";

// Tier colors: project (blue), tool (purple), kind (green) — color-blind safe.
const TIER_COLOR = ["#0072B2", "#CC79A7", "#009E73"];

interface NodeProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: { name?: string; value?: number; depth?: number };
}

function SankeyNode({ x = 0, y = 0, width = 0, height = 0, payload = {} }: NodeProps) {
  const depth = payload.depth ?? 0;
  const labelLeft = depth === 0;
  return (
    <g>
      <rect x={x} y={y} width={width} height={Math.max(1, height)} rx={2} fill={TIER_COLOR[Math.min(depth, 2)]} />
      <text
        x={labelLeft ? x - 6 : x + width + 6}
        y={y + height / 2}
        textAnchor={labelLeft ? "end" : "start"}
        dominantBaseline="middle"
        fill="#aab3c5"
        fontSize={10}
      >
        {payload.name}
        {payload.value != null ? ` (${payload.value})` : ""}
      </text>
    </g>
  );
}

export function SankeyFlow() {
  const { t } = useT();
  const { tick } = useLive();
  const [data, setData] = useState<SankeyData | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch("/api/sankey")
        .then((r) => r.json())
        .then((d: SankeyData) => {
          if (!cancelled) setData(d);
        })
        .catch(() => {});
    load();
    const poll = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, [tick]);

  return (
    <Panel title={t("sankey.title")} icon={<Workflow className="h-4 w-4 text-accent" />} info={t("sankey.info")}>
      {!data ? (
        <WidgetState icon={Workflow} title={t("common.loading")} loading />
      ) : data.links.length === 0 ? (
        <WidgetState icon={Workflow} title={t("sankey.empty")} />
      ) : (
        <div className="h-full w-full p-2">
          <ResponsiveContainer width="100%" height="100%">
            <Sankey
              data={data}
              node={<SankeyNode />}
              nodePadding={18}
              nodeWidth={10}
              link={{ stroke: "#2b3444", strokeOpacity: 0.35 }}
              margin={{ left: 70, right: 80, top: 8, bottom: 8 }}
            >
              <Tooltip
                contentStyle={{ background: "#0e1219", border: "1px solid #1c2230", borderRadius: 8, fontSize: 12 }}
              />
            </Sankey>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}
