import type { PluginQuery } from "@/components/plugin-data";

// Shared state-decision for data widgets, so all 30 panels render the same
// loading / error / empty / ready states from a `usePluginQuery` result.
// Pure (no React) on purpose — unit-testable and reused by every widget.

export type ViewState = "loading" | "error" | "empty" | "ready";

/**
 * Map a query result to a render state.
 * - `loading`  — first load in flight, nothing to show yet.
 * - `error`    — fetch failed and we have no previously-loaded data to fall back to.
 * - `empty`    — loaded successfully but there is nothing to display.
 * - `ready`    — data present (kept even during a background refetch/poll error).
 *
 * `isEmpty` decides emptiness for the widget's own shape (e.g. `d.items.length === 0`).
 */
export function viewState<T>(
  q: Pick<PluginQuery<T>, "data" | "loading" | "error">,
  isEmpty?: (data: T) => boolean,
): ViewState {
  if (q.data == null) {
    if (q.error) return "error";
    if (q.loading) return "loading";
    return "empty";
  }
  if (isEmpty?.(q.data)) return "empty";
  return "ready";
}
