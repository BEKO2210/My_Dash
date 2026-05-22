"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { Boxes } from "lucide-react";
import { Panel } from "@/components/panel";
import { useLive } from "@/components/live-provider";

// react-force-graph-3d pulls in three.js + WebGL → client only.
const ForceGraph3D = dynamic(() => import("react-force-graph-3d"), { ssr: false });

interface GraphNode {
  id: string;
  label: string;
  type: "session" | "tool" | "file";
  val: number;
}
interface GraphData {
  nodes: GraphNode[];
  links: { source: string; target: string }[];
}

const COLOR: Record<GraphNode["type"], string> = {
  session: "#4f8cff",
  tool: "#fbbf24",
  file: "#34d399",
};

export function ToolGraph() {
  const { tick } = useLive();
  const [data, setData] = useState<GraphData>({ nodes: [], links: [] });
  const wrapRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const lastFetch = useRef(0);

  useEffect(() => {
    // Debounce: at most one graph rebuild every 3s even under event bursts.
    const now = Date.now();
    const delay = Math.max(0, 3000 - (now - lastFetch.current));
    const t = setTimeout(() => {
      lastFetch.current = Date.now();
      fetch("/api/graph")
        .then((r) => r.json())
        .then((d: GraphData) => setData(d))
        .catch(() => {});
    }, delay);
    return () => clearTimeout(t);
  }, [tick]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setDims({ w: Math.floor(r.width), h: Math.floor(r.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const legend = useMemo(
    () => [
      { c: COLOR.session, t: "Session" },
      { c: COLOR.tool, t: "Tool" },
      { c: COLOR.file, t: "Datei" },
    ],
    [],
  );

  return (
    <Panel
      title="Tool-Graph (3D)"
      icon={<Boxes className="h-4 w-4 text-accent" />}
      right={
        <div className="flex items-center gap-3 text-[11px] text-muted">
          {legend.map((l) => (
            <span key={l.t} className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ background: l.c }} />
              {l.t}
            </span>
          ))}
        </div>
      }
    >
      <div ref={wrapRef} className="relative h-full w-full">
        {data.nodes.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted">
            <Boxes className="h-6 w-6 opacity-50" />
            <p>Noch keine Tool-Aufrufe.</p>
          </div>
        ) : dims.w > 0 ? (
          <ForceGraph3D
            width={dims.w}
            height={dims.h}
            graphData={data}
            backgroundColor="#07090d"
            nodeLabel={(n: object) => (n as GraphNode).label}
            nodeVal={(n: object) => (n as GraphNode).val}
            nodeColor={(n: object) => COLOR[(n as GraphNode).type]}
            nodeOpacity={0.9}
            linkColor={() => "#2a3344"}
            linkWidth={0.6}
            linkDirectionalParticles={1}
            linkDirectionalParticleWidth={1.4}
            warmupTicks={40}
            cooldownTicks={120}
          />
        ) : null}
      </div>
    </Panel>
  );
}
