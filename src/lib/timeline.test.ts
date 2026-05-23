import { describe, expect, it } from "vitest";
import { timelineLayout } from "@/lib/timeline";
import type { SessionRow } from "@/lib/types";

function session(over: Partial<SessionRow> & { id: string }): SessionRow {
  return {
    id: over.id,
    project_path: null,
    project_name: "proj",
    title: "Build it",
    status: "ended",
    source: null,
    first_seen: "2026-05-23 10:00:00",
    last_seen: "2026-05-23 10:30:00",
    ended_at: null,
    token_input: 0,
    token_output: 0,
    token_cache: 0,
    cost_usd: 0,
    branch: null,
    git_commit: null,
    ...over,
  };
}

// Window: 2026-05-23 10:00 .. 12:00 UTC
const from = Date.parse("2026-05-23T10:00:00Z");
const to = Date.parse("2026-05-23T12:00:00Z");

describe("timelineLayout", () => {
  it("positions a bar by start/end as a percentage of the window", () => {
    // 10:30 -> 11:00 within a 2h window: left 25%, width 25%
    const [bar] = timelineLayout(
      [session({ id: "s1", first_seen: "2026-05-23 10:30:00", ended_at: "2026-05-23 11:00:00" })],
      from,
      to,
    );
    expect(bar.leftPct).toBeCloseTo(25, 5);
    expect(bar.widthPct).toBeCloseTo(25, 5);
    expect(bar.status).toBe("ended");
  });

  it("uses last_seen when ended_at is null", () => {
    const [bar] = timelineLayout(
      [session({ id: "s1", first_seen: "2026-05-23 11:00:00", ended_at: null, last_seen: "2026-05-23 11:30:00" })],
      from,
      to,
    );
    expect(bar.leftPct).toBeCloseTo(50, 5);
    expect(bar.widthPct).toBeCloseTo(25, 5);
  });

  it("excludes sessions outside the window and sorts by start", () => {
    const bars = timelineLayout(
      [
        session({ id: "late", first_seen: "2026-05-23 11:30:00", ended_at: "2026-05-23 11:45:00" }),
        session({ id: "early", first_seen: "2026-05-23 10:05:00", ended_at: "2026-05-23 10:10:00" }),
        session({ id: "before", first_seen: "2026-05-23 08:00:00", ended_at: "2026-05-23 09:00:00" }),
      ],
      from,
      to,
    );
    expect(bars.map((b) => b.id)).toEqual(["early", "late"]);
  });

  it("clamps to a minimum visible width", () => {
    const [bar] = timelineLayout(
      [session({ id: "s1", first_seen: "2026-05-23 10:30:00", ended_at: "2026-05-23 10:30:01" })],
      from,
      to,
    );
    expect(bar.widthPct).toBeGreaterThanOrEqual(0.6);
  });
});
