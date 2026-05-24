"use client";

import { useEffect, useState } from "react";
import { useLive } from "@/components/live-provider";

// Typed data API for plugins. `usePluginQuery` removes the fetch + poll + tick +
// cancellation boilerplate every widget repeats; `useLiveTick` exposes the live
// refresh tick without pulling in the whole live provider. Read-only by design —
// these only GET from the dashboard's own /api/* routes.

export function useLiveTick(): number {
  return useLive().tick;
}

export interface PluginQuery<T> {
  data: T | null;
  loading: boolean;
  error: boolean;
}

export function usePluginQuery<T>(path: string, opts?: { pollMs?: number }): PluginQuery<T> {
  const pollMs = opts?.pollMs ?? 15_000;
  const tick = useLive().tick;
  const [state, setState] = useState<PluginQuery<T>>({ data: null, loading: true, error: false });

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch(path)
        .then((r) => (r.ok ? (r.json() as Promise<T>) : Promise.reject(new Error("bad status"))))
        .then((d) => {
          if (!cancelled) setState({ data: d, loading: false, error: false });
        })
        .catch(() => {
          if (!cancelled) setState((s) => ({ data: s.data, loading: false, error: true }));
        });
    load();
    const id = pollMs > 0 ? setInterval(load, pollMs) : null;
    return () => {
      cancelled = true;
      if (id) clearInterval(id);
    };
    // Re-fetch when the path changes (e.g. a filter param) or the live tick bumps.
  }, [path, pollMs, tick]);

  return state;
}
