import { EventEmitter } from "node:events";
import type { StreamMessage } from "./types";
import { log } from "./log";

// In-process pub/sub: /api/ingest publishes, /api/stream (SSE) subscribes.
// Single Node process (local tool) → in-memory fanout is all we need.
const globalForBus = globalThis as unknown as { __mcBus?: EventEmitter };

const bus = globalForBus.__mcBus ?? new EventEmitter();
bus.setMaxListeners(0); // many concurrent SSE clients allowed
globalForBus.__mcBus = bus;

// Publishing must never throw or stall the ingest write path that calls it, so a
// subscriber error is isolated and logged rather than propagated.
export function publish(msg: StreamMessage): void {
  try {
    bus.emit("event", msg);
  } catch (err) {
    log.error("event bus publish failed", err);
  }
}

export function subscribe(fn: (msg: StreamMessage) => void): () => void {
  // Wrap so one misbehaving subscriber can't break emit for the others (or for
  // the publisher).
  const safe = (msg: StreamMessage) => {
    try {
      fn(msg);
    } catch (err) {
      log.error("event bus subscriber threw", err);
    }
  };
  bus.on("event", safe);
  return () => bus.off("event", safe);
}
