import { test, expect, request as playwrightRequest, type APIRequestContext, type Page } from "@playwright/test";

const BASE_URL = "http://127.0.0.1:3100";
const PROJECT = "kanban-bot";
const TITLE = "Kanban audit session";
const SESSION_ID = `kanban-${Date.now()}`;

test.beforeAll(async () => {
  const ctx: APIRequestContext = await playwrightRequest.newContext({ baseURL: BASE_URL });
  const base = { session_id: SESSION_ID, cwd: `/home/user/projects/${PROJECT}` };
  const post = (event: string, payload: Record<string, unknown>) =>
    ctx.post("/api/ingest", {
      headers: { "X-Hook-Event": event, "Content-Type": "application/json" },
      data: { ...payload, hook_event_name: event },
    });
  await post("SessionStart", { ...base, source: "startup" });
  await post("UserPromptSubmit", { ...base, prompt: TITLE });
  await post("PostToolUse", { ...base, tool_name: "Read", tool_input: { file_path: "/x.ts" }, tool_response: { ok: true } });
  await post("SessionEnd", { ...base }); // → "ended" column
  await ctx.dispose();
});

function prime(page: Page) {
  return page.addInitScript(() => {
    try {
      localStorage.setItem("mc-onboarded", "1");
    } catch {
      /* ignore */
    }
  });
}

function card(page: Page) {
  return page.getByRole("button").filter({ hasText: TITLE }).first();
}

test("card opens the detail dialog with a drilldown link, then closes", async ({ page }) => {
  await prime(page);
  await page.goto("/");
  await expect(page.getByTestId("connection-status")).toHaveAttribute("data-state", "connected", { timeout: 15_000 });

  await expect(card(page)).toBeVisible({ timeout: 15_000 });
  await card(page).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: TITLE })).toBeVisible();
  await expect(dialog.getByText(PROJECT, { exact: true })).toBeVisible();
  // Drilldown to the full session page.
  await expect(dialog.getByRole("link")).toHaveAttribute("href", `/session?id=${SESSION_ID}`);

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("status facet filters the board", async ({ page }) => {
  await prime(page);
  // The seeded session is ended → visible under status=ended, hidden under status=active.
  await page.goto("/?status=ended");
  await expect(card(page)).toBeVisible({ timeout: 15_000 });

  await page.goto("/?status=active");
  await expect(page.getByTestId("connection-status")).toHaveAttribute("data-state", "connected", { timeout: 15_000 });
  await expect(card(page)).toHaveCount(0);
});
