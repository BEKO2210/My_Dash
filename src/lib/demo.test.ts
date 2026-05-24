import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  demoUsage,
  demoLatency,
  demoErrors,
  demoSankey,
  demoStreak,
  demoCompactions,
  demoCalendar,
  demoVelocity,
  demoSessionDuration,
} from "./demo";

// Z-Demo-1: the in-browser demo engine must be deterministic. Each snapshot
// getter re-seeds its PRNG on entry (seedSnap), so it returns identical data on
// every call — no per-poll jitter, reproducible screenshots/GIFs across reloads.
// Before the fix these getters drew from one ever-advancing sequence, so two
// consecutive calls differed. These tests would fail against that behaviour.
const getters = {
  demoUsage,
  demoLatency,
  demoErrors,
  demoSankey,
  demoStreak,
  demoCompactions,
  demoCalendar,
  demoVelocity,
  demoSessionDuration,
} as const;

describe("demo getters are deterministic", () => {
  // Freeze the clock so "now"-relative timestamps don't drift between calls;
  // the only remaining variation would come from the PRNG, which is what we test.
  beforeEach(() => vi.useFakeTimers({ now: new Date("2026-05-24T12:00:00.000Z") }));
  afterEach(() => vi.useRealTimers());

  for (const [name, fn] of Object.entries(getters)) {
    it(`${name}() returns identical data on repeated calls`, () => {
      expect(fn()).toEqual(fn());
    });
  }

  it("interleaving getters does not perturb a getter's output", () => {
    // Each getter re-seeds, so calling others in between is invisible.
    const first = demoUsage();
    demoLatency();
    demoSankey();
    demoVelocity();
    expect(demoUsage()).toEqual(first);
  });
});
