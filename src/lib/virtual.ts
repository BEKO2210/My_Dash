// Tiny, dependency-free fixed-height list virtualization. Pure math so it's testable
// and reusable: given the scroll position, viewport height and row height, it returns
// the slice of rows to render plus the top/bottom padding that preserves scroll height.

export interface VirtualWindow {
  start: number;
  end: number; // exclusive
  padTop: number;
  padBottom: number;
}

export function windowRange(opts: {
  scrollTop: number;
  viewport: number;
  rowHeight: number;
  count: number;
  overscan?: number;
}): VirtualWindow {
  const { count } = opts;
  const overscan = opts.overscan ?? 6;
  // Degenerate inputs (no measurement yet / empty) → render everything.
  if (opts.rowHeight <= 0 || opts.viewport <= 0 || count <= 0) {
    return { start: 0, end: count, padTop: 0, padBottom: 0 };
  }
  const scrollTop = Math.max(0, opts.scrollTop);
  const first = Math.floor(scrollTop / opts.rowHeight);
  const visible = Math.ceil(opts.viewport / opts.rowHeight);
  const start = Math.max(0, first - overscan);
  const end = Math.min(count, first + visible + overscan);
  return {
    start,
    end,
    padTop: start * opts.rowHeight,
    padBottom: Math.max(0, (count - end) * opts.rowHeight),
  };
}
