import { test, expect, request as playwrightRequest, type APIRequestContext } from "@playwright/test";

const BASE_URL = "http://127.0.0.1:3100";
const PROJECT = "shopify-bot";
const TITLE = "E2E smoke prompt";

async function post(ctx: APIRequestContext, event: string, payload: Record<string, unknown>) {
  const res = await ctx.post("/api/ingest", {
    headers: { "X-Hook-Event": event, "Content-Type": "application/json" },
    data: { ...payload, hook_event_name: event },
  });
  expect(res.ok(), `${event} should be accepted`).toBeTruthy();
}

// Drive the only write path (/api/ingest) like a real hook would, so the whole
// pipeline (ingest -> DB -> sessions/events/SSE) is exercised end to end.
async function seed(ctx: APIRequestContext) {
  const base = { session_id: `e2e-${Date.now()}`, cwd: `/home/user/projects/${PROJECT}` };
  await post(ctx, "SessionStart", { ...base, source: "startup" });
  await post(ctx, "UserPromptSubmit", { ...base, prompt: TITLE });
  await post(ctx, "PreToolUse", { ...base, tool_name: "Read", tool_input: { file_path: "/x.ts" } });
  await post(ctx, "PostToolUse", {
    ...base,
    tool_name: "Read",
    tool_input: { file_path: "/x.ts" },
    tool_response: { ok: true },
  });
  await post(ctx, "Stop", { ...base });
}

test.beforeAll(async () => {
  const ctx = await playwrightRequest.newContext({ baseURL: BASE_URL });
  await seed(ctx);
  await ctx.dispose();
});

test("dashboard renders all four widgets and connects", async ({ page }) => {
  const response = await page.goto("/");

  // Security headers are served by the local server.
  expect(response?.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response?.headers()["x-frame-options"]).toBe("DENY");

  await expect(page.getByRole("heading", { name: "Claude Mission Control" })).toBeVisible();

  // Nineteen widget panels (+ mcp-servers).
  await expect(page.locator("section")).toHaveCount(19);
  // Two titles are identical in both locales — safe to assert regardless of language.
  await expect(page.getByText("Sessions", { exact: true })).toBeVisible();
  await expect(page.getByText("Live Stream", { exact: true })).toBeVisible();

  // SSE establishes the live connection.
  await expect(page.getByTestId("connection-status")).toHaveAttribute("data-state", "connected", {
    timeout: 15_000,
  });
});

test("seeded activity flows into the live stream and kanban", async ({ page }) => {
  await page.goto("/");

  // Live stream shows the backlog (delivered via /api/events then SSE).
  await expect(page.getByRole("log").getByRole("listitem").first()).toBeVisible({ timeout: 15_000 });

  // Kanban shows the seeded session card by its prompt-derived title, with the
  // project name on it. Scope to the card button so we don't match the project
  // filter's <option> or the live-stream summary.
  const card = page.getByRole("button").filter({ hasText: TITLE }).first();
  await expect(card).toBeVisible({ timeout: 15_000 });
  await expect(card.getByText(PROJECT, { exact: true })).toBeVisible();
});
