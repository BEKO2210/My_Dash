import { EventEmitter } from "node:events";
import type { StreamMessage } from "./types";

// In-process pub/sub: /api/ingest publishes, /api/stream (SSE) subscribes.
// Single Node process (local tool) → in-memory fanout is all we need.
const globalForBus = globalThis as unknown as { __mcBus?: EventEmitter };

const bus = globalForBus.__mcBus ?? new EventEmitter();
bus.setMaxListeners(0); // many concurrent SSE clients allowed
globalForBus.__mcBus = bus;

export function publish(msg: StreamMessage): void {
  bus.emit("event", msg);
}

export function subscribe(fn: (msg: StreamMessage) => void): () => void {
  bus.on("event", fn);
  return () => bus.off("event", fn);
}
