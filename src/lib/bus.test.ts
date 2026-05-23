import { afterEach, describe, expect, it, vi } from "vitest";
import { publish, subscribe } from "@/lib/bus";
import type { StreamMessage } from "@/lib/types";

const msg = { event: { id: 1 }, session: { id: "s" } } as unknown as StreamMessage;

afterEach(() => vi.restoreAllMocks());

describe("event bus", () => {
  it("delivers published messages to a subscriber", () => {
    const got: StreamMessage[] = [];
    const unsub = subscribe((m) => got.push(m));
    publish(msg);
    expect(got).toEqual([msg]);
    unsub();
  });

  it("stops delivery after unsubscribe", () => {
    const got: StreamMessage[] = [];
    const unsub = subscribe((m) => got.push(m));
    unsub();
    publish(msg);
    expect(got).toHaveLength(0);
  });

  it("isolates a throwing subscriber so others still receive and publish never throws", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const got: StreamMessage[] = [];
    const u1 = subscribe(() => {
      throw new Error("bad subscriber");
    });
    const u2 = subscribe((m) => got.push(m));

    expect(() => publish(msg)).not.toThrow();
    expect(got).toEqual([msg]);

    u1();
    u2();
  });
});
