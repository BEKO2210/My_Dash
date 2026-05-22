"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { forceCollide } from "d3-force-3d";
import { Boxes, Maximize2, Minimize2, X } from "lucide-react";
import { Panel } from "@/components/panel";
import { useLive } from "@/components/live-provider";
import { useT } from "@/lib/i18n";
import { relativeTime, STATUS_META } from "@/lib/format";

// Wrapper preserves the imperative ref through next/dynamic (camera + bloom composer).
const ForceGraph3D = dynamic(() => import("./force-graph"), { ssr: false });

type NodeType = "session" | "tool" | "file" | "prompt";
type TargetKind = "file" | "command" | "url" | "pattern";
interface NodeMeta {
  sessionId?: string;
  project?: string | null;
  status?: string;
  lastSeen?: string;
  path?: string;
  kind?: TargetKind;
  calls?: number;
  role?: "user" | "agent";
  text?: string;
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

// One cohesive palette + noun map, keyed by the node's effective kind. Hues are
// spread evenly around the wheel for clear, harmonious distinction on the dark
// background. Claude reads meta.kind/role; humans read these.
const KIND_COLOR: Record<string, string> = {
  session: "#5b9dff", // blue   — the run itself
  prompt: "#ff6b9d", // rose   — prompts (you & Claude)
  tool: "#ffc53d", // amber  — tools
  file: "#3ee9a6", // emerald— files
  command: "#b98aff", // violet — shell commands
  url: "#34e0f5", // cyan   — URLs
  pattern: "#aab6cc", // slate  — patterns/queries
};
const KIND_ORDER = ["session", "prompt", "tool", "file", "command", "url", "pattern"] as const;
const SELECTED = "#f1f5f9";

const nodeKey = (n: GraphNode): string => (n.type === "file" ? n.meta?.kind ?? "file" : n.type);
const baseColor = (n: GraphNode): string => KIND_COLOR[nodeKey(n)] ?? KIND_COLOR.file;
const noun = (n: GraphNode, t: (k: string) => string): string => t(`graph.kind.${nodeKey(n)}`);

const endId = (e: string | GraphNode): string => (typeof e === "object" ? e.id : e);

// Darken a #rrggbb so non-active nodes recede behind the glowing active subgraph.
function dim(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${Math.round(((n >> 16) & 255) * f)},${Math.round(((n >> 8) & 255) * f)},${Math.round((n & 255) * f)})`;
}

export function ToolGraph() {
  const { tick } = useLive();
  const { t } = useT();
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
  const fitted = useRef(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const threeRef = useRef<any>(null);
  const [threeReady, setThreeReady] = useState(false);
  const sig = useRef("");

  // Load three on the client for the metallic node material.
  useEffect(() => {
    let cancelled = false;
    import("three")
      .then((m) => {
        if (!cancelled) {
          threeRef.current = m;
          setThreeReady(true);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // Debounce: at most one graph rebuild every 3s even under event bursts.
    const now = Date.now();
    const delay = Math.max(0, 3000 - (now - lastFetch.current));
    const t = setTimeout(() => {
      lastFetch.current = Date.now();
      fetch("/api/graph")
        .then((r) => r.json())
        .then((d: GraphData) => {
          // Only rebuild meshes when the graph structure actually changed.
          const next = d.nodes.map((n) => n.id).join(",") + "|" + d.links.length;
          if (next === sig.current) return;
          sig.current = next;
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

  const SIZE = maximized ? 4.6 : 3.6;
  const nodeRadius = useCallback((n: GraphNode) => Math.cbrt(Math.max(n.val, 0.6)) * SIZE, [SIZE]);

  // Colour + whether a node glows. Only the active subgraph (or the selection)
  // glows; everything else stays metallic-lit but unglowing.
  const styleFor = useCallback(
    (n: GraphNode): { color: string; glow: boolean } => {
      if (selected?.id === n.id) return { color: SELECTED, glow: true };
      const base = baseColor(n);
      if (activeIds.has(n.id)) return { color: base, glow: true };
      return { color: hasActive ? dim(base, 0.5) : base, glow: false };
    },
    [selected, activeIds, hasActive],
  );
  const styleRef = useRef(styleFor);
  const nodesRef = useRef<GraphNode[]>([]);
  useEffect(() => {
    styleRef.current = styleFor;
    nodesRef.current = data.nodes;
  });

  // Metallic, glossy spheres (Phong specular). Emissive only when glowing, so the
  // bloom lights up exactly the active elements — not everything.
  const nodeThreeObject = useCallback(
    (node: object) => {
      const THREE = threeRef.current;
      if (!THREE) return undefined;
      const n = node as GraphNode;
      const { color, glow } = styleRef.current(n);
      const mat = new THREE.MeshPhongMaterial({
        color,
        emissive: color,
        emissiveIntensity: glow ? 0.55 : 0,
        shininess: 120,
        specular: 0x9aa6c0,
      });
      return new THREE.Mesh(new THREE.SphereGeometry(nodeRadius(n), 28, 20), mat);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [threeReady, nodeRadius],
  );

  // Recolour existing meshes on selection/active change without rebuilding them.
  // Meshes are reached via a ref (not React state) so it's a pure side effect.
  useEffect(() => {
    if (!threeReady) return;
    for (const n of nodesRef.current) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mat = (n as any).__threeObj?.material;
      if (!mat?.color) continue;
      const { color, glow } = styleFor(n);
      mat.color.set(color);
      mat.emissive?.set?.(color);
      // eslint-disable-next-line react-hooks/immutability -- three.js material, not React state
      mat.emissiveIntensity = glow ? 0.55 : 0;
    }
  }, [selected, activeIds, threeReady, styleFor]);

  // Spacing + no overlap: repulsion, link distance, and a collision force whose
  // radius matches the sphere radius (+ padding) so spheres never overlap.
  useEffect(() => {
    const fg = fgRef.current;
    if (!threeReady || !fg?.d3Force) return;
    fg.d3Force("charge")?.strength?.(-90);
    fg.d3Force("link")?.distance?.(48);
    fg.d3Force("collide", forceCollide((n: object) => nodeRadius(n as GraphNode) + 4));
    fg.d3ReheatSimulation?.();
    fitted.current = false;
  }, [threeReady, maximized, nodeRadius, data.nodes.length]);

  const nodeById = useMemo(() => {
    const m = new Map<string, GraphNode>();
    for (const n of data.nodes) m.set(n.id, n);
    return m;
  }, [data.nodes]);

  const neighbours = useMemo(() => {
    const counts = { session: 0, prompt: 0, tool: 0, file: 0 };
    if (!selected) return counts;
    const ids = new Set<string>();
    for (const l of data.links) {
      const s = endId(l.source);
      const t = endId(l.target);
      if (s === selected.id) ids.add(t);
      else if (t === selected.id) ids.add(s);
    }
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
        // Selective bloom: high threshold so only the bright, emissive (active)
        // elements glow — not the whole graph.
        const bloom = new UnrealBloomPass(new THREE.Vector2(dims.w, dims.h), 0.85, 0.7, 0.38);
        composer.addPass(bloom);
        bloomRef.current = bloom;
        bloomAdded.current = true;

        // Real lighting → metallic highlight + visible 3D curvature. Ambient fills
        // shadows so unglowing nodes still read as solid (not pitch black).
        const scene = fgRef.current?.scene?.();
        scene?.traverse((o: { isLight?: boolean; type?: string; intensity?: number; color?: { set?: (c: number) => void } }) => {
          if (!o.isLight) return;
          if (o.type === "AmbientLight") {
            o.intensity = 0.65;
            o.color?.set?.(0xffffff);
          } else {
            o.intensity = 1.6; // restore directional → glossy highlight + depth
          }
        });
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
      // Subtle, smooth "breathing" of the glow (range ~0.36–0.56).
      if (b) b.strength = 0.46 + 0.1 * Math.sin(((now - start) / 1000) * 1.3);
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

  // Only show legend entries for kinds actually present in the current graph.
  const legend = useMemo(() => {
    const present = new Set(data.nodes.map((n) => nodeKey(n)));
    return KIND_ORDER.filter((k) => present.has(k)).map((k) => ({ c: KIND_COLOR[k], label: t(`graph.kind.${k}`) }));
  }, [data.nodes, t]);

  const view = (
    <div className={maximized ? "fixed inset-0 z-[60] bg-background p-3 sm:p-4" : "h-full"}>
      <Panel
        title={t("graph.title")}
        icon={<Boxes className="h-4 w-4 text-accent" />}
        info={t("graph.info")}
        right={
          <button
            onClick={() => setMaximized((m) => !m)}
            title={maximized ? t("graph.shrinkTitle") : t("graph.fullscreen")}
            className="flex items-center gap-1 rounded-md border border-panel-border px-2 py-1 text-[11px] text-muted transition-colors hover:border-accent/50 hover:text-foreground"
          >
            {maximized ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{maximized ? t("graph.shrink") : t("graph.fullscreen")}</span>
          </button>
        }
      >
        <div ref={wrapRef} className="relative h-full w-full">
          {data.nodes.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted">
              <Boxes className="h-6 w-6 opacity-50" />
              <p>{t("graph.empty")}</p>
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
                  return `<div style="font:12px sans-serif;color:#e5e7eb">${noun(g, t)}: ${g.label}</div>`;
                }}
                nodeVal={(n: object) => (n as GraphNode).val}
                nodeColor={(n: object) => {
                  const g = n as GraphNode;
                  if (selected?.id === g.id) return SELECTED;
                  const base = baseColor(g);
                  if (activeIds.has(g.id)) return base;
                  return hasActive ? dim(base, 0.62) : base;
                }}
                nodeOpacity={1}
                nodeRelSize={maximized ? 6 : 5}
                nodeResolution={maximized ? 32 : 24}
                nodeThreeObject={nodeThreeObject}
                onNodeClick={onNodeClick}
                onBackgroundClick={() => setSelected(null)}
                onEngineStop={() => {
                  if (fitted.current) return;
                  try {
                    fgRef.current?.zoomToFit?.(600, 40);
                    fitted.current = true;
                  } catch {
                    /* ref API unavailable */
                  }
                }}
                linkColor={(l: object) => {
                  const hot = isHot(l);
                  // Bright (above bloom threshold) → glows. Only active/selected links.
                  if (hot === "selected") return "#cfe0ff";
                  if (hot === "active") return "#5b9dff";
                  // Inactive links: visible grey but below the bloom threshold → no glow.
                  return hasActive ? "#2b3444" : "#3b4860";
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
              <div className="pointer-events-none absolute bottom-2 left-3 flex max-w-[78%] flex-wrap gap-x-2.5 gap-y-1 text-[10px] text-muted/80">
                {legend.map((l) => (
                  <span key={l.label} className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full" style={{ background: l.c }} />
                    {l.label}
                  </span>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </Panel>
    </div>
  );

  // In fullscreen, portal to <body> so no ancestor transform (entrance animation)
  // can clip `position: fixed` to a grid cell.
  return maximized && typeof document !== "undefined" ? createPortal(view, document.body) : view;
}

function DetailCard({
  node,
  neighbours,
  onClose,
}: {
  node: GraphNode;
  neighbours: { session: number; prompt: number; tool: number; file: number };
  onClose: () => void;
}) {
  const { t, lang } = useT();
  const meta = node.meta ?? {};
  return (
    <div className="absolute right-3 top-3 flex max-h-[calc(100%-1.5rem)] w-64 max-w-[80%] flex-col overflow-hidden rounded-lg border border-panel-border bg-panel/95 p-3 text-xs shadow-xl shadow-black/40 backdrop-blur">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: baseColor(node) }} />
          <span className="font-semibold text-foreground">{noun(node, t)}</span>
        </div>
        <button onClick={onClose} className="text-muted hover:text-foreground" title={t("common.close")}>
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto pr-0.5">
        <p className="mb-2 break-words text-sm text-foreground">{node.label}</p>

        <dl className="space-y-1 text-muted">
        {node.type === "session" && (
          <>
            <Row k={t("graph.project")} v={meta.project ?? "—"} />
            <Row
              k={t("graph.status")}
              v={
                <span className={STATUS_META[meta.status ?? ""]?.text ?? ""}>
                  {meta.status ? t(`status.${meta.status}`) : "—"}
                </span>
              }
            />
            <Row k={t("graph.lastActivity")} v={relativeTime(meta.lastSeen, lang)} />
            <Row k={t("graph.id")} v={<span className="font-mono">{(meta.sessionId ?? node.id).slice(0, 12)}</span>} />
            <Row k={t("graph.prompts")} v={String(neighbours.prompt)} />
            <Row k={t("graph.toolsConnected")} v={String(neighbours.tool)} />
          </>
        )}
        {node.type === "tool" && (
          <>
            <Row k={t("graph.calls")} v={String(node.val)} />
            <Row k={t("graph.targetsTouched")} v={String(neighbours.file)} />
          </>
        )}
        {node.type === "file" &&
          (() => {
            const kind = meta.kind ?? "file";
            if (kind === "command")
              return (
                <>
                  <Row k={t("graph.program")} v={node.label} />
                  <Row k={t("graph.calls")} v={String(meta.calls ?? node.val)} />
                  <Row k={t("graph.fromTools")} v={String(neighbours.tool)} />
                  {meta.path && <LongField label={t("graph.example")} text={meta.path} />}
                </>
              );
            if (kind === "url")
              return (
                <>
                  <Row k={t("graph.fromTools")} v={String(neighbours.tool)} />
                  <LongField label={t("graph.address")} text={meta.path ?? node.label} />
                </>
              );
            if (kind === "pattern")
              return (
                <>
                  <Row k={t("graph.fromTools")} v={String(neighbours.tool)} />
                  <LongField label={t("graph.pattern")} text={meta.path ?? node.label} />
                </>
              );
            return (
              <>
                <Row k={t("graph.fromToolsTouched")} v={String(neighbours.tool)} />
                <LongField label={t("graph.path")} text={meta.path ?? node.label} />
              </>
            );
          })()}
        {node.type === "prompt" && (
          <>
            <Row k={t("graph.from")} v={meta.role === "agent" ? t("graph.fromAgent") : t("graph.fromYou")} />
            <Row k={t("graph.time")} v={relativeTime(meta.lastSeen, lang)} />
            {meta.text && (
              <div className="mt-1 max-h-32 overflow-auto rounded bg-background/60 p-2 text-[11px] leading-relaxed text-foreground">
                {meta.text}
              </div>
            )}
          </>
        )}
        </dl>
      </div>
    </div>
  );
}

function LongField({ label, text }: { label: string; text: string }) {
  return (
    <div className="pt-0.5">
      <dt className="mb-0.5 text-muted">{label}</dt>
      <dd className="max-h-28 overflow-auto rounded bg-background/60 p-2 font-mono text-[11px] leading-relaxed break-all text-foreground">
        {text}
      </dd>
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
