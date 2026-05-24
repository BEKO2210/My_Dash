import { describe, it, expect } from "vitest";
import { autoRotateSpeed, AUTO_ROTATE_SPEED, RESUME_DELAY_MS, RAMP_MS } from "./auto-rotate";

describe("tool-graph auto-rotate timing", () => {
  it("idles at full epic speed until first touched", () => {
    expect(autoRotateSpeed(null)).toBe(AUTO_ROTATE_SPEED);
  });

  it("stays paused for the full 15s after interaction ends", () => {
    expect(autoRotateSpeed(0)).toBe(0);
    expect(autoRotateSpeed(RESUME_DELAY_MS - 1)).toBe(0);
    expect(autoRotateSpeed(RESUME_DELAY_MS)).toBe(0); // ramp k=0
  });

  it("eases gently back to full speed over the ramp window (never snaps)", () => {
    expect(autoRotateSpeed(RESUME_DELAY_MS + RAMP_MS / 2)).toBeCloseTo(AUTO_ROTATE_SPEED / 2, 5);
    expect(autoRotateSpeed(RESUME_DELAY_MS + RAMP_MS)).toBe(AUTO_ROTATE_SPEED);
  });

  it("never exceeds full speed once resumed", () => {
    expect(autoRotateSpeed(RESUME_DELAY_MS + RAMP_MS * 10)).toBe(AUTO_ROTATE_SPEED);
  });

  it("is monotonic non-decreasing across the resume ramp", () => {
    let prev = -1;
    for (let ms = RESUME_DELAY_MS; ms <= RESUME_DELAY_MS + RAMP_MS + 500; ms += 50) {
      const s = autoRotateSpeed(ms);
      expect(s).toBeGreaterThanOrEqual(prev);
      prev = s;
    }
    expect(prev).toBe(AUTO_ROTATE_SPEED);
  });
});
