"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Boxes, Maximize2, Minimize2, X } from "lucide-react";
import { Panel } from "@/components/panel";
import { useLive } from "@/components/live-provider";
import { relativeTime, STATUS_META } from "@/lib/format";

// Wrapper preserves the imperative ref through next/dynamic (camera + bloom composer).
const ForceGraph3D = dynamic(() => import("./force-graph"), { ssr: false });

type NodeType = "session" | "tool" | "file";
interface NodeMeta {
  sessionId?: string;
  project?: string | null;
  status?: string;
  lastSeen?: string;
  path?: string;
  calls?: number;
}
interface GraphNode {
  id: string;
  label: string;
  type: NodeType;
  val: number;
  meta?: NodeMeta;
  x?: number;
  y?: number;
  z?: number;
}
interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
}
interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

const COLOR: Record<NodeType, string> = {
  session: "#4f8cff",
  tool: "#fbbf24",
  file: "#34d399",
};
const TYPE_LABEL: Record<NodeType, string> = { session: "Session", tool: "Tool", file: "Datei" };
const SELECTED = "#dbe8ff";

const endId = (e: string | GraphNode): string => (typeof e === "object" ? e.id : e);

// Darken a #rrggbb so non-active nodes recede behind the glowing active subgraph.
function dim(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${Math.round(((n >> 16) & 255) * f)},${Math.round(((n >> 8) & 255) * f)},${Math.round((n & 255) * f)})`;
}

export function ToolGraph() {
  const { tick } = useLive();
  const [data, setData] = useState<GraphData>({ nodes: [], links: [] });
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [maximized, setMaximized] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const lastFetch = useRef(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fgRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bloomRef = useRef<any>(null);
  const bloomAdded = useRef(false);

  useEffect(() => {
    // Debounce: at most one graph rebuild every 3s even under event bursts.
    const now = Date.now();
    const delay = Math.max(0, 3000 - (now - lastFetch.current));
    const t = setTimeout(() => {
      lastFetch.current = Date.now();
      fetch("/api/graph")
        .then((r) => r.json())
        .then((d: GraphData) => {
          setData(d);
          setSelected((cur) => (cur ? d.nodes.find((n) => n.id === cur.id) ?? null : null));
        })
        .catch(() => {});
    }, delay);
    return () => clearTimeout(t);
  }, [tick]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      if (!entries.length) return;
      const r = entries[0].contentRect;
      setDims({ w: Math.floor(r.width), h: Math.floor(r.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [maximized]);

  useEffect(() => {
    if (!maximized) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMaximized(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [maximized]);

  // Active subgraph: nodes of an active session + the tools/files it reaches.
  const activeIds = useMemo(() => {
    const active = new Set<string>();
    for (const n of data.nodes) if (n.type === "session" && n.meta?.status === "active") active.add(n.id);
    // Propagate forward session → tool → file (graph is shallow, two passes suffice).
    for (let i = 0; i < 2; i++) {
      for (const l of data.links) {
        const s = endId(l.source);
        if (active.has(s)) active.add(endId(l.target));
      }
    }
    return active;
  }, [data]);
  const hasActive = activeIds.size > 0;

  const nodeById = useMemo(() => {
    const m = new Map<string, GraphNode>();
    for (const n of data.nodes) m.set(n.id, n);
    return m;
  }, [data.nodes]);

  const neighbours = useMemo(() => {
    if (!selected) return { session: 0, tool: 0, file: 0 };
    const ids = new Set<string>();
    for (const l of data.links) {
      const s = endId(l.source);
      const t = endId(l.target);
      if (s === selected.id) ids.add(t);
      else if (t === selected.id) ids.add(s);
    }
    const counts = { session: 0, tool: 0, file: 0 };
    for (const id of ids) {
      const n = nodeById.get(id);
      if (n) counts[n.type] += 1;
    }
    return counts;
  }, [selected, data.links, nodeById]);

  // Add a soft bloom pass once the 3D scene exists; retry briefly while it boots.
  useEffect(() => {
    if (bloomAdded.current || data.nodes.length === 0 || dims.w === 0) return;
    let cancelled = false;
    let tries = 0;
    const attach = async () => {
      if (cancelled || bloomAdded.current) return;
      const composer = fgRef.current?.postProcessingComposer?.();
      if (!composer) {
        if (tries++ < 20) setTimeout(attach, 150);
        return;
      }
      try {
        const [{ UnrealBloomPass }, THREE] = await Promise.all([
          import("three/examples/jsm/postprocessing/UnrealBloomPass.js"),
          import("three"),
        ]);
        if (cancelled) return;
        const bloom = new UnrealBloomPass(new THREE.Vector2(dims.w, dims.h), 0.32, 0.6, 0.4);
        composer.addPass(bloom);
        bloomRef.current = bloom;
        bloomAdded.current = true;
      } catch {
        /* bloom is a nicety — graph works without it */
      }
    };
    attach();
    return () => {
      cancelled = true;
    };
  }, [data.nodes.length, dims.w, dims.h]);

  // Gentle, professional "breathing" of the glow.
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const loop = (now: number) => {
      const b = bloomRef.current;
      // Subtle "breathing" — keep it understated/professional (range ~0.22–0.40).
      if (b) b.strength = 0.31 + 0.09 * Math.sin(((now - start) / 1000) * 1.3);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const focusNode = useCallback((node: GraphNode) => {
    const fg = fgRef.current;
    if (!fg?.cameraPosition || typeof node.x !== "number") return;
    const dist = 90;
    const hyp = Math.hypot(node.x, node.y ?? 0, node.z ?? 0) || 1;
    const ratio = 1 + dist / hyp;
    try {
      fg.cameraPosition(
        { x: node.x * ratio, y: (node.y ?? 0) * ratio, z: (node.z ?? 0) * ratio },
        node,
        800,
      );
    } catch {
      /* ref API unavailable — detail card still works */
    }
  }, []);

  const onNodeClick = useCallback(
    (node: object) => {
      const n = node as GraphNode;
      setSelected(n);
      focusNode(n);
    },
    [focusNode],
  );

  const isHot = useCallback(
    (l: object) => {
      const s = endId((l as GraphLink).source);
      const t = endId((l as GraphLink).target);
      if (selected && (s === selected.id || t === selected.id)) return "selected";
      if (activeIds.has(s) && activeIds.has(t)) return "active";
      return null;
    },
    [selected, activeIds],
  );

  const legend = useMemo(
    () => [
      { c: COLOR.session, t: "Session" },
      { c: COLOR.tool, t: "Tool" },
      { c: COLOR.file, t: "Datei" },
    ],
    [],
  );

  return (
    <div className={maximized ? "fixed inset-0 z-50 bg-background p-3 sm:p-4" : "h-full"}>
      <Panel
        title="Tool-Graph (3D)"
        icon={<Boxes className="h-4 w-4 text-accent" />}
        right={
          <div className="flex items-center gap-3 text-[11px] text-muted">
            <div className="hidden items-center gap-3 sm:flex">
              {legend.map((l) => (
                <span key={l.t} className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full" style={{ background: l.c }} />
                  {l.t}
                </span>
              ))}
            </div>
            <button
              onClick={() => setMaximized((m) => !m)}
              title={maximized ? "Verkleinern (Esc)" : "Vollbild"}
              className="flex items-center gap-1 rounded-md border border-panel-border px-2 py-1 text-muted transition-colors hover:border-accent/50 hover:text-foreground"
            >
              {maximized ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{maximized ? "Verkleinern" : "Vollbild"}</span>
            </button>
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
            <>
              <ForceGraph3D
                innerRef={fgRef}
                width={dims.w}
                height={dims.h}
                graphData={data}
                backgroundColor="#06070b"
                showNavInfo={false}
                nodeLabel={(n: object) => {
                  const g = n as GraphNode;
                  return `<div style="font:12px sans-serif;color:#e5e7eb">${TYPE_LABEL[g.type]}: ${g.label}</div>`;
                }}
                nodeVal={(n: object) => (n as GraphNode).val}
                nodeColor={(n: object) => {
                  const g = n as GraphNode;
                  if (selected?.id === g.id) return SELECTED;
                  if (activeIds.has(g.id)) return COLOR[g.type];
                  return hasActive ? dim(COLOR[g.type], 0.62) : COLOR[g.type];
                }}
                nodeOpacity={0.95}
                nodeRelSize={maximized ? 6 : 5}
                nodeResolution={18}
                onNodeClick={onNodeClick}
                onBackgroundClick={() => setSelected(null)}
                linkColor={(l: object) => {
                  const hot = isHot(l);
                  if (hot === "selected") return "#9ec5ff";
                  if (hot === "active") return "#4f8cff";
                  // Inactive links stay clearly visible, just subordinate to hot ones.
                  return hasActive ? "#3a465e" : "#46566f";
                }}
                linkWidth={(l: object) => {
                  const hot = isHot(l);
                  return hot === "selected" ? 1.8 : hot === "active" ? 1.1 : 0.6;
                }}
                linkOpacity={0.7}
                linkDirectionalParticles={(l: object) => (isHot(l) ? 2 : 0)}
                linkDirectionalParticleWidth={2}
                linkDirectionalParticleSpeed={0.008}
                linkDirectionalParticleColor={() => "#cfe3ff"}
                warmupTicks={40}
                cooldownTicks={120}
              />
              {selected && <DetailCard node={selected} neighbours={neighbours} onClose={() => setSelected(null)} />}
              <p className="pointer-events-none absolute bottom-2 left-3 text-[10px] text-muted/60">
                Knoten anklicken für Details · ziehen zum Drehen · scrollen zum Zoomen
              </p>
            </>
          ) : null}
        </div>
      </Panel>
    </div>
  );
}

function DetailCard({
  node,
  neighbours,
  onClose,
}: {
  node: GraphNode;
  neighbours: { session: number; tool: number; file: number };
  onClose: () => void;
}) {
  const meta = node.meta ?? {};
  return (
    <div className="absolute right-3 top-3 w-64 max-w-[80%] rounded-lg border border-panel-border bg-panel/95 p-3 text-xs shadow-xl shadow-black/40 backdrop-blur">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLOR[node.type] }} />
          <span className="font-semibold text-foreground">{TYPE_LABEL[node.type]}</span>
        </div>
        <button onClick={onClose} className="text-muted hover:text-foreground" title="Schließen">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <p className="mb-2 break-words text-sm text-foreground">{node.label}</p>

      <dl className="space-y-1 text-muted">
        {node.type === "session" && (
          <>
            <Row k="Projekt" v={meta.project ?? "—"} />
            <Row
              k="Status"
              v={
                <span className={STATUS_META[meta.status ?? ""]?.text ?? ""}>
                  {STATUS_META[meta.status ?? ""]?.label ?? meta.status ?? "—"}
                </span>
              }
            />
            <Row k="Letzte Aktivität" v={relativeTime(meta.lastSeen)} />
            <Row k="ID" v={<span className="font-mono">{(meta.sessionId ?? node.id).slice(0, 12)}</span>} />
            <Row k="Tools verbunden" v={String(neighbours.tool)} />
          </>
        )}
        {node.type === "tool" && (
          <>
            <Row k="Aufrufe" v={String(node.val)} />
            <Row k="Dateien berührt" v={String(neighbours.file)} />
          </>
        )}
        {node.type === "file" && (
          <>
            <Row k="Pfad" v={<span className="break-all font-mono text-[11px]">{meta.path ?? node.label}</span>} />
            <Row k="Von Tools berührt" v={String(neighbours.tool)} />
          </>
        )}
      </dl>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="shrink-0">{k}</dt>
      <dd className="text-right text-foreground">{v}</dd>
    </div>
  );
}
