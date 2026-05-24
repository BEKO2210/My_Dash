import { describe, expect, it } from "vitest";
import { shouldShowOnboarding } from "@/lib/onboarding";

describe("shouldShowOnboarding", () => {
  it("shows on a fresh install (not dismissed)", () => {
    expect(shouldShowOnboarding({ dismissed: false, forced: false })).toBe(true);
  });

  it("stays hidden once dismissed", () => {
    expect(shouldShowOnboarding({ dismissed: true, forced: false })).toBe(false);
  });

  it("force-opens regardless of the dismissed flag", () => {
    expect(shouldShowOnboarding({ dismissed: true, forced: true })).toBe(true);
  });
});
