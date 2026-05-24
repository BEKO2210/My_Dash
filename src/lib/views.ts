import { sanitizeIdList, sanitizeSizes, type SizeMap } from "./layout";
import { isTimeRange, type TimeRange } from "./time-range";

// A saved view = a named snapshot of the dashboard's layout (order/sizes/hidden)
// plus the active facets and time range. Persisted locally; pure (de)serialisation
// lives here so it's unit-testable.

export interface SavedView {
  name: string;
  order: string[];
  sizes: SizeMap;
  hidden: string[];
  project: string;
  status: string;
  range: TimeRange;
}

const STATUSES = ["", "active", "waiting", "ended"];

function sanitizeView(raw: unknown, validIds: string[]): SavedView | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const name = typeof o.name === "string" ? o.name.trim() : "";
  if (!name) return null;
  return {
    name: name.slice(0, 60),
    order: sanitizeIdList(o.order, validIds),
    sizes: sanitizeSizes(o.sizes, validIds),
    hidden: sanitizeIdList(o.hidden, validIds),
    project: typeof o.project === "string" ? o.project : "",
    status: typeof o.status === "string" && STATUSES.includes(o.status) ? o.status : "",
    range: isTimeRange(o.range) ? o.range : "all",
  };
}

export function sanitizeViews(raw: unknown, validIds: string[]): SavedView[] {
  if (!Array.isArray(raw)) return [];
  const out: SavedView[] = [];
  for (const item of raw) {
    const v = sanitizeView(item, validIds);
    if (v) out.push(v);
  }
  return out;
}

// Insert or replace a view by name (case-insensitive), keeping name order stable.
export function upsertView(views: SavedView[], view: SavedView): SavedView[] {
  const i = views.findIndex((v) => v.name.toLowerCase() === view.name.toLowerCase());
  if (i === -1) return [...views, view];
  const next = [...views];
  next[i] = view;
  return next;
}
