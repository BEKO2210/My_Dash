import { parseDbTime } from "./format";
import type { SessionRow } from "./types";

// Lay sessions out as Gantt bars on a [fromMs, toMs] time axis. Pure: positions are
// percentages of the window, so the widget just renders them.
export interface TimelineBar {
  id: string;
  title: string;
  project: string | null;
  status: string;
  startMs: number;
  endMs: number;
  leftPct: number;
  widthPct: number;
}

// The [from, to] window ending now for a given number of days. Keeps the impure
// Date.now() out of the component's render.
export function windowFor(days: number, nowMs: number = Date.now()): { fromMs: number; toMs: number } {
  return { fromMs: nowMs - days * 86_400_000, toMs: nowMs };
}

export function timelineLayout(sessions: SessionRow[], fromMs: number, toMs: number): TimelineBar[] {
  const span = Math.max(1, toMs - fromMs);
  const bars: TimelineBar[] = [];
  for (const s of sessions) {
    const start = parseDbTime(s.first_seen)?.getTime();
    const endRaw = (parseDbTime(s.ended_at) ?? parseDbTime(s.last_seen))?.getTime();
    if (start === undefined || endRaw === undefined) continue;
    const end = Math.max(endRaw, start);
    if (end < fromMs || start > toMs) continue; // outside the window
    const cStart = Math.max(start, fromMs);
    const cEnd = Math.min(end, toMs);
    bars.push({
      id: s.id,
      title: s.title ?? s.id.slice(0, 8),
      project: s.project_name,
      status: s.status,
      startMs: start,
      endMs: end,
      leftPct: ((cStart - fromMs) / span) * 100,
      widthPct: Math.max(0.6, ((cEnd - cStart) / span) * 100),
    });
  }
  return bars.sort((a, b) => a.startMs - b.startMs);
}
