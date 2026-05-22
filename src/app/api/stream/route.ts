import { subscribe } from "@/lib/bus";
import type { StreamMessage } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Server-Sent Events: pushes every ingested event to connected dashboards in real time.
export async function GET(req: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let active = true;
      // Safe enqueue: never throws if the client already disconnected.
      const send = (data: string) => {
        if (!active) return;
        try {
          controller.enqueue(encoder.encode(data));
        } catch {
          active = false;
        }
      };

      // Initial comment so the browser marks the connection open immediately.
      send(": connected\n\n");

      const unsubscribe = subscribe((msg: StreamMessage) => {
        send(`data: ${JSON.stringify(msg)}\n\n`);
      });

      // Keep-alive ping so proxies/browsers don't drop an idle connection.
      const ping = setInterval(() => send(": ping\n\n"), 25_000);

      const close = () => {
        active = false;
        clearInterval(ping);
        unsubscribe();
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
