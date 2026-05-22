"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { EventRow, StreamMessage } from "@/lib/types";
import { DEMO, demoEvents, demoSubscribe } from "@/lib/demo";

interface LiveContextValue {
  events: EventRow[]; // newest first, capped
  connected: boolean;
  tick: number; // bumps on every event → widgets refetch derived data
}

const LiveContext = createContext<LiveContextValue>({ events: [], connected: false, tick: 0 });

const MAX_EVENTS = 300;

export function LiveProvider({ children }: { children: React.ReactNode }) {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [connected, setConnected] = useState(DEMO); // demo: "connected" from the start

  const [tick, setTick] = useState(0);
  const seen = useRef<Set<number>>(new Set());

  useEffect(() => {
    let closed = false;
    let es: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let backoff = 1000; // grows to a 15s ceiling so a down server is retried gently

    const ingestEvent = (e: EventRow) => {
      if (seen.current.has(e.id)) return;
      seen.current.add(e.id);
      if (seen.current.size > MAX_EVENTS * 4) {
        seen.current = new Set([...seen.current].slice(-MAX_EVENTS));
      }
      setEvents((prev) => [e, ...prev].slice(0, MAX_EVENTS));
      setTick((t) => t + 1);
    };

    // Demo mode: drive the stream from the in-browser engine (no SSE/server).
    if (DEMO) {
      for (const e of demoEvents(100).reverse()) ingestEvent(e);
      const unsub = demoSubscribe((msg) => ingestEvent(msg.event));
      return () => {
        closed = true;
        unsub();
      };
    }

    // Pull recent events — on first load and again after every (re)connect so any
    // events that happened during a gap (server restart, sleep) aren't lost.
    const loadBacklog = () =>
      fetch("/api/events?limit=100")
        .then((r) => r.json())
        .then((d: { events: EventRow[] }) => {
          if (closed) return;
          // Merge oldest→newest so ordering + dedup stay correct.
          for (const e of [...d.events].reverse()) ingestEvent(e);
        })
        .catch(() => {});

    const connect = () => {
      if (closed) return;
      es = new EventSource("/api/stream");
      es.onopen = () => {
        if (closed) return;
        setConnected(true);
        backoff = 1000;
        loadBacklog();
      };
      es.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data) as StreamMessage;
          ingestEvent(msg.event);
        } catch {
          /* ignore malformed frame */
        }
      };
      es.onerror = () => {
        if (closed) return;
        setConnected(false);
        // Browser auto-reconnects while the handle is open; if it hard-closed
        // (e.g. server returned non-2xx), recreate it ourselves with backoff.
        if (es && es.readyState === EventSource.CLOSED) {
          es.close();
          es = null;
          retry = setTimeout(connect, backoff);
          backoff = Math.min(backoff * 2, 15_000);
        }
      };
    };

    loadBacklog();
    connect();

    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      es?.close();
    };
  }, []);

  return (
    <LiveContext.Provider value={{ events, connected, tick }}>{children}</LiveContext.Provider>
  );
}

export function useLive(): LiveContextValue {
  return useContext(LiveContext);
}
