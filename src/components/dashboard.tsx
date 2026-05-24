"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  Bookmark,
  BookmarkPlus,
  Check,
  Eye,
  EyeOff,
  GripHorizontal,
  LayoutGrid,
  Link2,
  MessageSquare,
  MoveHorizontal,
  MoveVertical,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { LiveProvider, useLive } from "@/components/live-provider";
import { RadarLogo } from "@/components/radar-logo";
import { LangToggle } from "@/components/lang-toggle";
import { InfoHint } from "@/components/info-hint";
import { WidgetErrorBoundary } from "@/components/error-boundary";
import { Landing } from "@/components/landing";
import { SearchProvider, useSearch } from "@/components/search";
import { TimeRangeProvider, useTimeRange } from "@/components/time-range";
import { FacetProvider, useFacets } from "@/components/facets";
import { CommandPalette } from "@/components/command-palette";
import { useT } from "@/lib/i18n";
import { TIME_RANGES } from "@/lib/time-range";
import type { SearchHit } from "@/lib/search-index";
import { sanitizeViews, upsertView, type SavedView } from "@/lib/views";
import { DEMO, installDemoBackend } from "@/lib/demo";
import {
  HEIGHT_PRESETS,
  nextPreset,
  sanitizeIdList,
  sanitizeSizes,
  SPAN_PRESETS,
  type SizeMap,
} from "@/lib/layout";
import { widgets } from "@/plugins/registry";

// In the static demo build, start the in-browser engine + patch fetch before any
// widget mounts. No-op in the real (server-backed) app.
if (DEMO) installDemoBackend();

const DEFAULT_ORDER = widgets.map((w) => w.id);
const ORDER_KEY = "mc-widget-order";
const SIZE_KEY = "mc-widget-sizes";
const HIDDEN_KEY = "mc-widget-hidden";

function loadSizes(): SizeMap {
  try {
    const raw = localStorage.getItem(SIZE_KEY);
    if (!raw) return {};
    return sanitizeSizes(JSON.parse(raw), DEFAULT_ORDER);
  } catch {
    return {};
  }
}

function loadHidden(): string[] {
  try {
    const raw = localStorage.getItem(HIDDEN_KEY);
    if (!raw) return [];
    return sanitizeIdList(JSON.parse(raw), DEFAULT_ORDER);
  } catch {
    return [];
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
  const [hidden, setHidden] = useState<string[]>([]);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  useEffect(() => {
    // Defer to a frame so the saved layout is adopted after hydration (avoids a
    // server/client DOM mismatch when a custom layout is stored).
    const id = requestAnimationFrame(() => {
      setOrder(loadOrder());
      setSizes(loadSizes());
      setHidden(loadHidden());
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const isCustom =
    order.join(",") !== DEFAULT_ORDER.join(",") || Object.keys(sizes).length > 0 || hidden.length > 0;

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

  const persistHidden = useCallback((next: string[]) => {
    setHidden(next);
    try {
      if (next.length === 0) localStorage.removeItem(HIDDEN_KEY);
      else localStorage.setItem(HIDDEN_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable — visibility still applies for this session */
    }
  }, []);

  const toggleHidden = useCallback(
    (id: string) => {
      setHidden((prev) => {
        const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
        try {
          if (next.length === 0) localStorage.removeItem(HIDDEN_KEY);
          else localStorage.setItem(HIDDEN_KEY, JSON.stringify(next));
        } catch {
          /* storage unavailable */
        }
        return next;
      });
    },
    [],
  );

  const resetLayout = useCallback(() => {
    persist(DEFAULT_ORDER);
    persistSizes({});
    persistHidden([]);
  }, [persist, persistSizes, persistHidden]);

  // Apply a saved view's layout, reconciling any widgets added since it was saved.
  const applyLayout = useCallback(
    (nextOrder: string[], nextSizes: SizeMap, nextHidden: string[]) => {
      const full = [...nextOrder, ...DEFAULT_ORDER.filter((id) => !nextOrder.includes(id))];
      persist(full);
      persistSizes(nextSizes);
      persistHidden(nextHidden);
    },
    [persist, persistSizes, persistHidden],
  );

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
    () =>
      order
        .map((id) => byId.get(id))
        .filter((w): w is (typeof widgets)[number] => Boolean(w) && !hidden.includes(w!.id)),
    [order, byId, hidden],
  );

  return (
    <LiveProvider>
      <SearchProvider>
        <TimeRangeProvider>
        <FacetProvider>
        {DEMO && <Landing />}
        <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col gap-4 p-4 sm:p-6 min-[2560px]:max-w-none min-[2560px]:gap-6 min-[2560px]:p-8 min-[3840px]:gap-8 min-[3840px]:p-12">
          <Header
            isCustomLayout={isCustom}
            onResetLayout={resetLayout}
            onOpenGallery={() => setGalleryOpen(true)}
            order={order}
            sizes={sizes}
            hidden={hidden}
            onApplyLayout={applyLayout}
          />
          {ordered.length === 0 && (
            <div className="rounded-xl border border-dashed border-panel-border bg-panel/40 p-10 text-center text-sm text-muted">
              {t("gallery.allHidden")}
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 min-[2560px]:gap-6 min-[3840px]:gap-8 lg:grid-cols-6">
            {ordered.map((w, i) => {
              const span = sizes[w.id]?.span ?? w.span;
              const height = sizes[w.id]?.height ?? w.height;
              return (
              <div
                key={w.id}
                id={`mc-widget-${w.id}`}
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
        {galleryOpen && (
          <WidgetGallery
            order={order}
            byId={byId}
            hidden={hidden}
            onToggle={toggleHidden}
            onShowAll={() => persistHidden([])}
            onClose={() => setGalleryOpen(false)}
          />
        )}
        <CommandPalette onResetLayout={resetLayout} onOpenGallery={() => setGalleryOpen(true)} />
        </FacetProvider>
        </TimeRangeProvider>
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
  onOpenGallery,
  order,
  sizes,
  hidden,
  onApplyLayout,
}: {
  isCustomLayout: boolean;
  onResetLayout: () => void;
  onOpenGallery: () => void;
  order: string[];
  sizes: SizeMap;
  hidden: string[];
  onApplyLayout: (order: string[], sizes: SizeMap, hidden: string[]) => void;
}) {
  const { connected, events } = useLive();
  const { t, lang } = useT();
  const { query, setQuery } = useSearch();
  const [clock, setClock] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);

  useEffect(() => {
    const update = () => setClock(new Date().toLocaleTimeString(lang === "en" ? "en-GB" : "de-DE"));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [lang]);

  // Debounced full-text search across the whole DB (FTS5) for the results dropdown.
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) return;
    let cancelled = false;
    const id = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(term)}`)
        .then((r) => r.json())
        .then((d: { hits: SearchHit[] }) => {
          if (!cancelled) setHits(d.hits ?? []);
        })
        .catch(() => {});
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [query]);

  const shownHits = query.trim().length >= 2 ? hits : [];

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
          {shownHits.length > 0 && (
            <div className="absolute right-0 top-9 z-50 max-h-80 w-72 overflow-auto rounded-lg border border-panel-border bg-panel shadow-2xl shadow-black/50 lg:w-80">
              <p className="border-b border-panel-border px-3 py-1.5 text-[10px] uppercase tracking-wide text-muted">
                {t("search.results")}
              </p>
              <ul>
                {shownHits.map((h) => (
                  <li key={`${h.kind}-${h.ref_id}-${h.session_id}`}>
                    <Link
                      href={`/session?id=${encodeURIComponent(h.session_id)}`}
                      onMouseDown={() => setQuery("")}
                      className="flex items-start gap-2 px-3 py-2 transition-colors hover:bg-white/[0.04]"
                    >
                      {h.kind === "prompt" ? (
                        <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-400" />
                      ) : (
                        <Activity className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                      )}
                      <span className="line-clamp-2 text-xs text-foreground">{h.text}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </label>
        <FacetBar />
        <TimeRangePicker />
        <ViewsMenu order={order} sizes={sizes} hidden={hidden} onApplyLayout={onApplyLayout} />
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event("mc:open-command"))}
          aria-label={t("cmd.title")}
          title={t("cmd.title")}
          className="hidden items-center gap-1 rounded-full border border-panel-border bg-background/40 px-2 py-1 font-mono text-[11px] text-muted transition-colors hover:border-accent/50 hover:text-foreground sm:flex"
        >
          ⌘K
        </button>
        <CopyLinkButton />
        <button
          type="button"
          onClick={onOpenGallery}
          aria-label={t("gallery.title")}
          title={t("gallery.title")}
          className="hidden items-center rounded-full border border-panel-border bg-background/40 p-1.5 text-muted transition-colors hover:border-accent/50 hover:text-foreground sm:flex"
        >
          <LayoutGrid className="h-3.5 w-3.5" />
        </button>
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

const VIEWS_KEY = "mc-views";

function ViewsMenu({
  order,
  sizes,
  hidden,
  onApplyLayout,
}: {
  order: string[];
  sizes: SizeMap;
  hidden: string[];
  onApplyLayout: (order: string[], sizes: SizeMap, hidden: string[]) => void;
}) {
  const { t } = useT();
  const { project, status, setProject, setStatus } = useFacets();
  const { range, setRange } = useTimeRange();
  const [views, setViews] = useState<SavedView[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      try {
        const raw = localStorage.getItem(VIEWS_KEY);
        if (raw) setViews(sanitizeViews(JSON.parse(raw), DEFAULT_ORDER));
      } catch {
        /* ignore */
      }
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const persistViews = (next: SavedView[]) => {
    setViews(next);
    try {
      if (next.length === 0) localStorage.removeItem(VIEWS_KEY);
      else localStorage.setItem(VIEWS_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const save = () => {
    const n = name.trim();
    if (!n) return;
    persistViews(upsertView(views, { name: n, order, sizes, hidden, project, status, range }));
    setName("");
  };

  const apply = (v: SavedView) => {
    onApplyLayout(v.order, v.sizes, v.hidden);
    setProject(v.project);
    setStatus(v.status);
    setRange(v.range);
    setOpen(false);
  };

  return (
    <div className="relative hidden sm:block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={t("views.title")}
        title={t("views.title")}
        className="flex items-center rounded-full border border-panel-border bg-background/40 p-1.5 text-muted transition-colors hover:border-accent/50 hover:text-foreground"
      >
        <Bookmark className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-50 w-64 rounded-lg border border-panel-border bg-panel p-2 shadow-2xl shadow-black/50">
          <div className="flex gap-1.5">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && save()}
              placeholder={t("views.namePlaceholder")}
              aria-label={t("views.save")}
              className="min-w-0 flex-1 rounded-md border border-panel-border bg-background/40 px-2 py-1 text-xs text-foreground outline-none focus:border-accent"
            />
            <button
              type="button"
              onClick={save}
              title={t("views.save")}
              className="shrink-0 rounded-md border border-accent/40 bg-accent/10 px-2 text-accent transition-colors hover:bg-accent/20"
            >
              <BookmarkPlus className="h-3.5 w-3.5" />
            </button>
          </div>
          {views.length === 0 ? (
            <p className="px-1 py-3 text-center text-[11px] text-muted">{t("views.empty")}</p>
          ) : (
            <ul className="mt-1.5 max-h-64 overflow-auto">
              {views.map((v) => (
                <li key={v.name} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => apply(v)}
                    className="min-w-0 flex-1 truncate rounded-md px-2 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-white/[0.04]"
                  >
                    {v.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => persistViews(views.filter((x) => x.name !== v.name))}
                    aria-label={t("views.delete")}
                    title={t("views.delete")}
                    className="shrink-0 p-1 text-muted hover:text-red-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function FacetBar() {
  const { t } = useT();
  const { tick } = useLive();
  const { project, status, setProject, setStatus, active, clear } = useFacets();
  const [projects, setProjects] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/usage/projects")
      .then((r) => r.json())
      .then((d: { projects: { project: string }[] }) => {
        if (!cancelled) setProjects((d.projects ?? []).map((p) => p.project).filter((p) => p && p !== "(unknown)"));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [tick]);

  const cls =
    "hidden rounded-full border border-panel-border bg-background/40 px-2.5 py-1 text-xs text-muted outline-none transition-colors hover:border-accent/50 focus:border-accent sm:block";

  return (
    <>
      <select value={project} onChange={(e) => setProject(e.target.value)} aria-label={t("facets.project")} title={t("facets.project")} className={cls}>
        <option value="">{t("facets.allProjects")}</option>
        {projects.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
      <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label={t("facets.status")} title={t("facets.status")} className={cls}>
        <option value="">{t("facets.allStatus")}</option>
        <option value="active">{t("status.active")}</option>
        <option value="waiting">{t("status.waiting")}</option>
        <option value="ended">{t("status.ended")}</option>
      </select>
      {active && (
        <button
          type="button"
          onClick={clear}
          aria-label={t("facets.clear")}
          title={t("facets.clear")}
          className="hidden items-center rounded-full border border-accent/40 bg-accent/10 p-1.5 text-accent transition-colors hover:bg-accent/20 sm:flex"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </>
  );
}

function CopyLinkButton() {
  const { t } = useT();
  const [copied, setCopied] = useState(false);
  const copy = () => {
    try {
      void navigator.clipboard?.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={t("deeplink.copy")}
      title={copied ? t("deeplink.copied") : t("deeplink.copy")}
      className="hidden items-center rounded-full border border-panel-border bg-background/40 p-1.5 text-muted transition-colors hover:border-accent/50 hover:text-foreground sm:flex"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Link2 className="h-3.5 w-3.5" />}
    </button>
  );
}

function TimeRangePicker() {
  const { t } = useT();
  const { range, setRange } = useTimeRange();
  return (
    <select
      value={range}
      onChange={(e) => setRange(e.target.value as (typeof TIME_RANGES)[number])}
      aria-label={t("range.label")}
      title={t("range.label")}
      className="hidden rounded-full border border-panel-border bg-background/40 px-2.5 py-1 text-xs text-muted outline-none transition-colors hover:border-accent/50 focus:border-accent sm:block"
    >
      {TIME_RANGES.map((r) => (
        <option key={r} value={r}>
          {t(`range.${r}`)}
        </option>
      ))}
    </select>
  );
}

function WidgetGallery({
  order,
  byId,
  hidden,
  onToggle,
  onShowAll,
  onClose,
}: {
  order: string[];
  byId: Map<string, (typeof widgets)[number]>;
  hidden: string[];
  onToggle: (id: string) => void;
  onShowAll: () => void;
  onClose: () => void;
}) {
  const { t } = useT();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const items = order
    .map((id) => byId.get(id))
    .filter((w): w is (typeof widgets)[number] => Boolean(w));
  const visibleCount = items.filter((w) => !hidden.includes(w.id)).length;

  return (
    <div role="dialog" aria-modal="true" aria-label={t("gallery.title")} className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative z-10 flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-panel-border bg-panel shadow-2xl shadow-black/50">
        <header className="flex items-center justify-between border-b border-panel-border px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <LayoutGrid className="h-4 w-4 text-accent" />
            {t("gallery.title")}
            <span className="text-xs font-normal text-muted">
              {visibleCount}/{items.length}
            </span>
          </div>
          <button type="button" onClick={onClose} aria-label={t("gallery.close")} title={t("gallery.close")} className="text-muted hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </header>
        <p className="px-4 pt-3 text-xs text-muted">{t("gallery.info")}</p>
        <ul className="min-h-0 flex-1 overflow-auto p-2">
          {items.map((w) => {
            const isHidden = hidden.includes(w.id);
            return (
              <li key={w.id}>
                <button
                  type="button"
                  onClick={() => onToggle(w.id)}
                  aria-pressed={!isHidden}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-white/[0.04]"
                >
                  {isHidden ? (
                    <EyeOff className="h-4 w-4 shrink-0 text-muted" />
                  ) : (
                    <Eye className="h-4 w-4 shrink-0 text-accent" />
                  )}
                  <span className={`flex-1 truncate ${isHidden ? "text-muted line-through" : "text-foreground"}`}>
                    {w.title}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <footer className="flex justify-end gap-2 border-t border-panel-border px-4 py-3">
          <button type="button" onClick={onShowAll} className="rounded-md border border-panel-border px-3 py-1.5 text-xs text-muted transition-colors hover:text-foreground">
            {t("gallery.showAll")}
          </button>
          <button type="button" onClick={onClose} className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent/90">
            {t("gallery.done")}
          </button>
        </footer>
      </div>
    </div>
  );
}
