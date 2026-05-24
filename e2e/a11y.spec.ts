import { test, expect, request as playwrightRequest, type APIRequestContext, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const BASE_URL = "http://127.0.0.1:3100";
const PROJECT = "a11y-bot";
const SESSION_ID = `a11y-${Date.now()}`;

// Seed a little data so the widgets render populated states (not just empty ones),
// driven through the only write path like the smoke test does.
async function post(ctx: APIRequestContext, event: string, payload: Record<string, unknown>) {
  await ctx.post("/api/ingest", {
    headers: { "X-Hook-Event": event, "Content-Type": "application/json" },
    data: { ...payload, hook_event_name: event },
  });
}

test.beforeAll(async () => {
  const ctx = await playwrightRequest.newContext({ baseURL: BASE_URL });
  const base = { session_id: SESSION_ID, cwd: `/home/user/projects/${PROJECT}` };
  await post(ctx, "SessionStart", { ...base, source: "startup" });
  await post(ctx, "UserPromptSubmit", { ...base, prompt: "Accessibility audit prompt" });
  await post(ctx, "PostToolUse", { ...base, tool_name: "Read", tool_input: { file_path: "/x.ts" }, tool_response: { ok: true } });
  await post(ctx, "Stop", { ...base });
  await ctx.dispose();
});

// WCAG 2.1 A/AA, the conventional automated bar. Fail only on serious/critical so
// the gate is meaningful without being noisy about minor best-practice hints.
async function scan(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
}

function report(violations: { id: string; impact?: string | null; nodes: unknown[] }[]) {
  return JSON.stringify(
    violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length })),
    null,
    2,
  );
}

// Returning-user state: keep the first-run wizard out of these scans.
function suppressOnboarding(page: Page) {
  return page.addInitScript(() => {
    try {
      localStorage.setItem("mc-onboarded", "1");
    } catch {
      /* ignore */
    }
  });
}

test("dashboard has no serious or critical accessibility violations", async ({ page }) => {
  await suppressOnboarding(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Claude Mission Control" })).toBeVisible();
  await expect(page.getByTestId("connection-status")).toHaveAttribute("data-state", "connected", { timeout: 15_000 });

  const violations = await scan(page);
  expect(violations, report(violations)).toEqual([]);
});

test("session detail page has no serious or critical accessibility violations", async ({ page }) => {
  await suppressOnboarding(page);
  await page.goto(`/session?id=${SESSION_ID}`);
  await expect(page.getByRole("heading", { name: "Accessibility audit prompt" })).toBeVisible({ timeout: 15_000 });

  const violations = await scan(page);
  expect(violations, report(violations)).toEqual([]);
});

test("first-run onboarding wizard has no serious or critical accessibility violations", async ({ page }) => {
  // Fresh visitor (no suppression) → the wizard auto-opens.
  await page.goto("/");
  await expect(page.getByRole("dialog").first()).toBeVisible({ timeout: 15_000 });

  const violations = await scan(page);
  expect(violations, report(violations)).toEqual([]);
});
