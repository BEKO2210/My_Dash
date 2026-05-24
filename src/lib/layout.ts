// Per-widget size overrides for the dashboard grid. Widths map to the 6-col
// desktop grid; heights cycle through a few presets. Kept here (pure) so the
// cycling + persistence-sanitising logic is unit-testable.

export const SPAN_PRESETS = [
  "lg:col-span-2",
  "lg:col-span-3",
  "lg:col-span-4",
  "lg:col-span-6",
];

export const HEIGHT_PRESETS = [
  "h-[300px]",
  "h-[360px] min-[2560px]:h-[480px] min-[3840px]:h-[660px]",
  "h-[520px] min-[2560px]:h-[680px] min-[3840px]:h-[900px]",
  "h-auto",
];

export interface WidgetSize {
  span: string;
  height: string;
}

export type SizeMap = Record<string, WidgetSize>;

// Next entry in a preset list, wrapping around. Falls back to the first entry
// when the current value isn't a known preset (e.g. a widget's default span).
export function nextPreset(list: string[], current: string): string {
  const i = list.indexOf(current);
  return list[(i + 1) % list.length] ?? list[0];
}

// Keep only known string ids (deduped), e.g. the hidden-widget list.
export function sanitizeIdList(raw: unknown, validIds: string[]): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  for (const id of raw) {
    if (typeof id === "string" && validIds.includes(id)) seen.add(id);
  }
  return [...seen];
}

// Keep only overrides for known widgets that carry a valid span + height.
export function sanitizeSizes(raw: unknown, validIds: string[]): SizeMap {
  if (!raw || typeof raw !== "object") return {};
  const out: SizeMap = {};
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!validIds.includes(id)) continue;
    const o = v as { span?: unknown; height?: unknown };
    if (typeof o.span === "string" && typeof o.height === "string") {
      out[id] = { span: o.span, height: o.height };
    }
  }
  return out;
}
