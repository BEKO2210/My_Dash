"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { isTimeRange, rangeToDays, type TimeRange } from "@/lib/time-range";

interface TimeRangeValue {
  range: TimeRange;
  days: number;
  setRange: (r: TimeRange) => void;
}

const TimeRangeContext = createContext<TimeRangeValue>({
  range: "all",
  days: rangeToDays("all"),
  setRange: () => {},
});

const KEY = "mc-time-range";

// Dashboard-wide date range. Read-only over the data — widgets just narrow their
// window. Synced to the `?range=` query param (shareable, local) and localStorage.
export function TimeRangeProvider({ children }: { children: React.ReactNode }) {
  const [range, setRangeState] = useState<TimeRange>("all");

  useEffect(() => {
    // Adopt the saved/URL range after hydration (default "all" is render-safe).
    const id = requestAnimationFrame(() => {
      let initial: TimeRange | null = null;
      try {
        const q = new URLSearchParams(window.location.search).get("range");
        if (isTimeRange(q)) initial = q;
      } catch {
        /* ignore */
      }
      if (!initial) {
        try {
          const s = localStorage.getItem(KEY);
          if (isTimeRange(s)) initial = s;
        } catch {
          /* ignore */
        }
      }
      if (initial) setRangeState(initial);
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const setRange = useCallback((r: TimeRange) => {
    setRangeState(r);
    try {
      localStorage.setItem(KEY, r);
    } catch {
      /* ignore */
    }
    try {
      const url = new URL(window.location.href);
      if (r === "all") url.searchParams.delete("range");
      else url.searchParams.set("range", r);
      window.history.replaceState(null, "", url.toString());
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(() => ({ range, days: rangeToDays(range), setRange }), [range, setRange]);
  return <TimeRangeContext.Provider value={value}>{children}</TimeRangeContext.Provider>;
}

export function useTimeRange(): TimeRangeValue {
  return useContext(TimeRangeContext);
}
