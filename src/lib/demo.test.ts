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
  demoSessions,
  startDemo,
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

// Z-Demo-2: as the live engine runs, the economy must only ever climb (no
// jumping up and down) and ended sessions must persist (never rotate out). Drive
// the engine via the fake clock and assert both invariants on every tick.
describe("demo live evolution is monotonic and persistent", () => {
  it("cost/tokens only rise and ended sessions never disappear", () => {
    vi.useFakeTimers({ now: new Date("2026-05-24T12:00:00.000Z") });
    try {
      startDemo(); // 4 sessions + 30 pre-warm steps, then a 1100ms interval
      let prevCost = -1;
      let prevTokens = -1;
      let prevEnded = -1;
      for (let i = 0; i < 150; i++) {
        vi.advanceTimersByTime(1100); // one step
        const today = demoUsage().days.at(-1)!;
        expect(today.costUsd).toBeGreaterThanOrEqual(prevCost);
        expect(today.totalTokens).toBeGreaterThanOrEqual(prevTokens);
        const ended = demoSessions().filter((s) => s.status === "ended").length;
        expect(ended).toBeGreaterThanOrEqual(prevEnded);
        prevCost = today.costUsd;
        prevTokens = today.totalTokens;
        prevEnded = ended;
      }
      // The economy actually grew (not flat) and history genuinely accumulated.
      expect(prevCost).toBeGreaterThan(0);
      expect(prevEnded).toBeGreaterThan(0);
      // Live (non-ended) sessions stay calm — capped, never an ever-growing crowd.
      const live = demoSessions().filter((s) => s.status !== "ended").length;
      expect(live).toBeLessThanOrEqual(6);
    } finally {
      vi.useRealTimers();
    }
  });
});
