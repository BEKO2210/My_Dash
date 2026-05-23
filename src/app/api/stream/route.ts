import { db } from "@/lib/db";
import { subscribe } from "@/lib/bus";
import { eventsSince, parseLastEventId, sseFrame } from "@/lib/sse";
import type { StreamMessage } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cap concurrent SSE clients so a runaway tab-loop can't exhaust handles.
function maxClients(): number {
  const n = Number(process.env.MC_MAX_SSE_CLIENTS);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 64;
}
// How many missed events a single reconnect will replay.
const REPLAY_LIMIT = 1000;

const globalForSse = globalThis as unknown as { __mcSseCount?: number };

// Server-Sent Events: pushes every ingested event to connected dashboards in real
// time. On (re)connect it replays anything newer than Last-Event-ID so a gap
// (server restart, sleep, dropped connection) never loses events.
export async function GET(req: Request) {
  const active = globalForSse.__mcSseCount ?? 0;
  if (active >= maxClients()) {
    return new Response("too many connections", { status: 503 });
  }
  globalForSse.__mcSseCount = active + 1;

  const encoder = new TextEncoder();
  const url = new URL(req.url);
  // EventSource resends the id via the Last-Event-ID header on auto-reconnect; a
  // manual reconnect passes it as a query param instead.
  const lastEventId =
    parseLastEventId(req.headers.get("last-event-id")) ??
    parseLastEventId(url.searchParams.get("lastEventId"));

  const stream = new ReadableStream({
    start(controller) {
      let open = true;
      // Highest id sent so far; lets replay and live delivery dedup against
      // each other without a race.
      let lastSent = lastEventId ?? 0;

      // Safe enqueue: never throws if the client already disconnected.
      const send = (data: string) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(data));
        } catch {
          open = false;
        }
      };

      // Initial comment so the browser marks the connection open immediately.
      send(": connected\n\n");

      // Subscribe first so no event published during replay is missed; the
      // lastSent guard drops anything already covered by the replay.
      const unsubscribe = subscribe((msg: StreamMessage) => {
        if (msg.event.id <= lastSent) return;
        lastSent = msg.event.id;
        send(sseFrame(msg.event.id, msg));
      });

      // Replay the gap (synchronous DB read — no live event can interleave).
      if (lastEventId) {
        try {
          for (const e of eventsSince(db, lastEventId, REPLAY_LIMIT)) {
            if (e.id <= lastSent) continue;
            lastSent = e.id;
            send(sseFrame(e.id, { event: e }));
          }
        } catch {
          /* a replay failure shouldn't tear down the live stream */
        }
      }

      // Keep-alive ping so proxies/browsers don't drop an idle connection.
      const ping = setInterval(() => send(": ping\n\n"), 25_000);

      const close = () => {
        open = false;
        clearInterval(ping);
        unsubscribe();
        globalForSse.__mcSseCount = Math.max(0, (globalForSse.__mcSseCount ?? 1) - 1);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      req.signal.addEventListener("abort", close);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
