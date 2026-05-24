// Pure helpers behind the KPI bar's count-up animation, sparkline and error tone.
// Kept out of the component so the math is unit-testable.

export function easeOutCubic(p: number): number {
  const c = Math.min(1, Math.max(0, p));
  return 1 - Math.pow(1 - c, 3);
}

// Eased interpolation from `from` to `to` at progress p (0..1).
export function countUpValue(from: number, to: number, p: number): number {
  return from + (to - from) * easeOutCubic(p);
}

// Traffic-light tone for an error rate (0..1).
export function errorTone(rate: number): string {
  if (rate >= 0.2) return "text-red-400";
  if (rate >= 0.05) return "text-amber-400";
  return "text-emerald-400";
}

// SVG polyline points for a sparkline over a w×h box. Null when there's too little
// data to draw a line.
export function sparklinePoints(data: number[], w = 100, h = 24): string | null {
  if (data.length < 2) return null;
  const max = Math.max(1, ...data);
  return data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * h}`).join(" ");
}
