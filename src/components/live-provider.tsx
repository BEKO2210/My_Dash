"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { EventRow, StreamMessage } from "@/lib/types";

interface LiveContextValue {
  events: EventRow[]; // newest first, capped
  connected: boolean;
  tick: number; // bumps on every event → widgets refetch derived data
}

const LiveContext = createContext<LiveContextValue>({ events: [], connected: false, tick: 0 });

const MAX_EVENTS = 300;

export function LiveProvider({ children }: { children: React.ReactNode }) {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [connected, setConnected] = useState(false);
  const [tick, setTick] = useState(0);
  const seen = useRef<Set<number>>(new Set());

  useEffect(() => {
    let closed = false;

    // Backlog so the stream isn't empty on first load.
    fetch("/api/events?limit=100")
      .then((r) => r.json())
      .then((d: { events: EventRow[] }) => {
        if (closed) return;
        for (const e of d.events) seen.current.add(e.id);
        setEvents(d.events);
      })
      .catch(() => {});

    const es = new EventSource("/api/stream");
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data) as StreamMessage;
        if (seen.current.has(msg.event.id)) return;
        seen.current.add(msg.event.id);
        setEvents((prev) => [msg.event, ...prev].slice(0, MAX_EVENTS));
        setTick((t) => t + 1);
      } catch {
        /* ignore malformed frame */
      }
    };

    return () => {
      closed = true;
      es.close();
    };
  }, []);

  return (
    <LiveContext.Provider value={{ events, connected, tick }}>{children}</LiveContext.Provider>
  );
}

export function useLive(): LiveContextValue {
  return useContext(LiveContext);
}
