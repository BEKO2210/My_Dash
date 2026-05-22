import { subscribe } from "@/lib/bus";
import type { StreamMessage } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Server-Sent Events: pushes every ingested event to connected dashboards in real time.
export async function GET(req: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: string) => controller.enqueue(encoder.encode(data));

      // Initial comment so the browser marks the connection open immediately.
      send(": connected\n\n");

      const unsubscribe = subscribe((msg: StreamMessage) => {
        try {
          send(`data: ${JSON.stringify(msg)}\n\n`);
        } catch {
          /* controller closed — cleaned up below */
        }
      });

      // Keep-alive ping so proxies/browsers don't drop an idle connection.
      const ping = setInterval(() => send(": ping\n\n"), 25_000);

      const close = () => {
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
