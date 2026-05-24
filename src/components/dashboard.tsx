"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, GripHorizontal, MoveHorizontal, MoveVertical, RotateCcw, Search, X } from "lucide-react";
import { LiveProvider, useLive } from "@/components/live-provider";
import { RadarLogo } from "@/components/radar-logo";
import { LangToggle } from "@/components/lang-toggle";
import { InfoHint } from "@/components/info-hint";
import { WidgetErrorBoundary } from "@/components/error-boundary";
import { Landing } from "@/components/landing";
import { SearchProvider, useSearch } from "@/components/search";
import { useT } from "@/lib/i18n";
import { DEMO, installDemoBackend } from "@/lib/demo";
import { HEIGHT_PRESETS, nextPreset, sanitizeSizes, SPAN_PRESETS, type SizeMap } from "@/lib/layout";
import { widgets } from "@/plugins/registry";

// In the static demo build, start the in-browser engine + patch fetch before any
// widget mounts. No-op in the real (server-backed) app.
if (DEMO) installDemoBackend();

const DEFAULT_ORDER = widgets.map((w) => w.id);
const ORDER_KEY = "mc-widget-order";
const SIZE_KEY = "mc-widget-sizes";

function loadSizes(): SizeMap {
  try {
    const raw = localStorage.getItem(SIZE_KEY);
    if (!raw) return {};
    return sanitizeSizes(JSON.parse(raw), DEFAULT_ORDER);
  } catch {
    return {};
  }
}

// Read a saved panel order, keeping only known ids and appending any new widgets
// so the layout survives plugin additions/removals.
function loadOrder(): string[] {
  try {
    const raw = localStorage.getItem(ORDER_KEY);
    if (!raw) return DEFAULT_ORDER;
    const saved = JSON.parse(raw) as unknown;
    if (!Array.isArray(saved)) return DEFAULT_ORDER;
    const valid = saved.filter((id): id is string => typeof id === "string" && DEFAULT_ORDER.includes(id));
    const missing = DEFAULT_ORDER.filter((id) => !valid.includes(id));
    return [...valid, ...missing];
  } catch {
    return DEFAULT_ORDER;
  }
}

export function Dashboard() {
  const { t } = useT();
  // Start from the default order (hydration-safe), then adopt any saved order.
  const [order, setOrder] = useState<string[]>(DEFAULT_ORDER);
  const [sizes, setSizes] = useState<SizeMap>({});
  const [dragId, setDragId] = useState<string | null>(null);

  useEffect(() => {
    // Defer to a frame so the saved layout is adopted after hydration (avoids a
    // server/client DOM mismatch when a custom layout is stored).
    const id = requestAnimationFrame(() => {
      setOrder(loadOrder());
      setSizes(loadSizes());
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const isCustom = order.join(",") !== DEFAULT_ORDER.join(",") || Object.keys(sizes).length > 0;

  const persist = useCallback((next: string[]) => {
    setOrder(next);
    try {
      if (next.join(",") === DEFAULT_ORDER.join(",")) localStorage.removeItem(ORDER_KEY);
      else localStorage.setItem(ORDER_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable — order still applies for this session */
    }
  }, []);

  const persistSizes = useCallback((next: SizeMap) => {
    setSizes(next);
    try {
      if (Object.keys(next).length === 0) localStorage.removeItem(SIZE_KEY);
      else localStorage.setItem(SIZE_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable — sizes still apply for this session */
    }
  }, []);

  // Set a widget's size, dropping the override when it matches the registry default.
  const setSize = useCallback(
    (id: string, span: string, height: string) => {
      const def = widgets.find((w) => w.id === id);
      const next = { ...sizes };
      if (def && span === def.span && height === def.height) delete next[id];
      else next[id] = { span, height };
      persistSizes(next);
    },
    [sizes, persistSizes],
  );

  const resetLayout = useCallback(() => {
    persist(DEFAULT_ORDER);
    persistSizes({});
  }, [persist, persistSizes]);

  const onDropOn = useCallback(
    (targetId: string) => {
      setDragId((current) => {
        if (!current || current === targetId) return null;
        const a = [...order];
        const from = a.indexOf(current);
        const to = a.indexOf(targetId);
        if (from < 0 || to < 0) return null;
        a.splice(from, 1);
        a.splice(to, 0, current);
        persist(a);
        return null;
      });
    },
    [order, persist],
  );

  const byId = useMemo(() => new Map(widgets.map((w) => [w.id, w])), []);
  const ordered = useMemo(
    () => order.map((id) => byId.get(id)).filter((w): w is (typeof widgets)[number] => Boolean(w)),
    [order, byId],
  );

  return (
    <LiveProvider>
      <SearchProvider>
        {DEMO && <Landing />}
        <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col gap-4 p-4 sm:p-6 min-[2560px]:max-w-none min-[2560px]:gap-6 min-[2560px]:p-8 min-[3840px]:gap-8 min-[3840px]:p-12">
          <Header isCustomLayout={isCustom} onResetLayout={resetLayout} />
          <div className="grid grid-cols-1 gap-4 min-[2560px]:gap-6 min-[3840px]:gap-8 lg:grid-cols-6">
            {ordered.map((w, i) => {
              const span = sizes[w.id]?.span ?? w.span;
              const height = sizes[w.id]?.height ?? w.height;
              return (
              <div
                key={w.id}
                // The 3D graph goes fullscreen via position:fixed, which breaks if an
                // ancestor has a transform. So its cell uses an opacity-only entrance
                // (no transform) while the others keep the subtle rise. `relative`
                // does not establish a containing block for fixed children, so the
                // drag handle below is safe for the fullscreen graph.
                className={`group relative ${w.id === "tool-graph" ? "mc-fade-in" : "mc-fade-up"} ${span} ${height} ${dragId === w.id ? "opacity-50" : ""}`}
                style={{ animationDelay: `${i * 80}ms` }}
                onDragOver={(e) => {
                  if (dragId) e.preventDefault();
                }}
                onDrop={() => onDropOn(w.id)}
              >
                <WidgetToolbar
                  dragLabel={t("layout.drag")}
                  widthLabel={t("layout.width")}
                  heightLabel={t("layout.height")}
                  onStart={() => setDragId(w.id)}
                  onEnd={() => setDragId(null)}
                  onWidth={() => setSize(w.id, nextPreset(SPAN_PRESETS, span), height)}
                  onHeight={() => setSize(w.id, span, nextPreset(HEIGHT_PRESETS, height))}
                />
                <WidgetErrorBoundary
                  label={w.title}
                  couldNotLoad={t("error.couldNotLoad")}
                  genericText={t("error.generic")}
                  retryLabel={t("common.retry")}
                >
                  <w.component />
                </WidgetErrorBoundary>
              </div>
              );
            })}
          </div>
          <footer className="pt-2 text-center text-[11px] text-muted/60">
            {t("footer.text")} · <span className="text-muted">by Belkis Aslani</span>
          </footer>
        </div>
      </SearchProvider>
    </LiveProvider>
  );
}

function WidgetToolbar({
  dragLabel,
  widthLabel,
  heightLabel,
  onStart,
  onEnd,
  onWidth,
  onHeight,
}: {
  dragLabel: string;
  widthLabel: string;
  heightLabel: string;
  onStart: () => void;
  onEnd: () => void;
  onWidth: () => void;
  onHeight: () => void;
}) {
  const btn =
    "rounded p-0.5 text-muted transition-colors hover:text-foreground focus-visible:text-foreground";
  return (
    <div className="absolute left-1/2 top-1 z-20 flex -translate-x-1/2 items-center gap-0.5 rounded-md border border-panel-border bg-panel/90 px-1 py-0.5 opacity-0 shadow-md shadow-black/30 backdrop-blur transition-opacity duration-150 focus-within:opacity-100 group-hover:opacity-100">
      <button
        type="button"
        draggable
        aria-label={dragLabel}
        title={dragLabel}
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          // Some browsers require data to be set for a drag to begin.
          e.dataTransfer.setData("text/plain", "");
          onStart();
        }}
        onDragEnd={onEnd}
        className={`${btn} cursor-grab active:cursor-grabbing`}
      >
        <GripHorizontal className="h-3.5 w-3.5" />
      </button>
      <button type="button" aria-label={widthLabel} title={widthLabel} onClick={onWidth} className={btn}>
        <MoveHorizontal className="h-3.5 w-3.5" />
      </button>
      <button type="button" aria-label={heightLabel} title={heightLabel} onClick={onHeight} className={btn}>
        <MoveVertical className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function Header({
  isCustomLayout,
  onResetLayout,
}: {
  isCustomLayout: boolean;
  onResetLayout: () => void;
}) {
  const { connected, events } = useLive();
  const { t, lang } = useT();
  const { query, setQuery } = useSearch();
  const [clock, setClock] = useState("");

  useEffect(() => {
    const update = () => setClock(new Date().toLocaleTimeString(lang === "en" ? "en-GB" : "de-DE"));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [lang]);

  return (
    <header className="mc-fade-in flex items-center justify-between gap-3 rounded-xl border border-panel-border bg-panel/60 px-5 py-3 backdrop-blur">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background/80 ring-1 ring-accent/25">
          <RadarLogo className="h-7 w-7" />
        </span>
        <div className="min-w-0">
          <h1 className="flex items-center gap-1.5 text-base font-semibold tracking-tight">
            Claude Mission Control
            <InfoHint align="left" text={t("header.info")} />
          </h1>
          <p className="truncate text-[11px] text-muted">{t("header.subtitle")}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted sm:gap-2.5">
        <label className="relative hidden items-center sm:flex">
          <Search className="pointer-events-none absolute left-2 h-3.5 w-3.5 text-muted/70" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("search.placeholder")}
            aria-label={t("search.label")}
            className="w-36 rounded-full border border-panel-border bg-background/40 py-1 pl-7 pr-7 text-xs text-foreground outline-none transition-colors focus:border-accent lg:w-56"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label={t("search.clear")}
              title={t("search.clear")}
              className="absolute right-1.5 text-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </label>
        {isCustomLayout && (
          <button
            type="button"
            onClick={onResetLayout}
            aria-label={t("layout.reset")}
            title={t("layout.reset")}
            className="hidden items-center rounded-full border border-panel-border bg-background/40 p-1.5 text-muted transition-colors hover:border-accent/50 hover:text-foreground sm:flex"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        )}
        <LangToggle />
        <span className="hidden font-mono tabular-nums sm:inline">{clock}</span>
        <span className="hidden items-center gap-1 rounded-full border border-panel-border bg-background/40 px-2.5 py-1 tabular-nums sm:flex">
          <Activity className="h-3 w-3 text-accent" />
          {events.length}
          <InfoHint text={t("header.eventsInfo")} align="right" />
        </span>
        <span
          data-testid="connection-status"
          data-state={connected ? "connected" : "disconnected"}
          className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition-colors ${
            connected
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
              : "border-red-500/30 bg-red-500/10 text-red-400"
          }`}
        >
          <span
            className={`mc-live-dot h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-red-500"}`}
          />
          {connected ? t("header.connected") : t("header.disconnected")}
        </span>
      </div>
    </header>
  );
}
