import { test, expect, request as playwrightRequest, type APIRequestContext, type Page } from "@playwright/test";

// Run 119c — global interactions & final sweep (not a single widget):
// language/theme toggles, global search filtering, info hints, layout reset, and
// that every read API route responds. Seeds via the only write path so the
// dashboard is populated for the cross-cutting checks.
const BASE_URL = "http://127.0.0.1:3100";
const MARKER = "GlobalAuditMarker";

test.beforeAll(async () => {
  const ctx: APIRequestContext = await playwrightRequest.newContext({ baseURL: BASE_URL });
  const base = { session_id: `global-${Date.now()}`, cwd: "/home/user/projects/global-bot" };
  const post = (event: string, payload: Record<string, unknown>) =>
    ctx.post("/api/ingest", {
      headers: { "X-Hook-Event": event, "Content-Type": "application/json" },
      data: { ...payload, hook_event_name: event },
    });
  await post("SessionStart", { ...base, source: "startup" });
  await post("UserPromptSubmit", { ...base, prompt: MARKER });
  await post("PreToolUse", { ...base, tool_name: "Read", tool_input: { file_path: "/x.ts" } });
  await post("PostToolUse", { ...base, tool_name: "Read", tool_input: { file_path: "/x.ts" }, tool_response: { ok: true } });
  await post("Stop", { ...base });
  await ctx.dispose();
});

function prime(page: Page, mode: "dark" | "light", lang: "de" | "en") {
  return page.addInitScript(
    ([m, l]) => {
      try {
        localStorage.setItem("mc-onboarded", "1");
        localStorage.setItem("mc-theme", JSON.stringify({ mode: m, accent: "#4f8cff" }));
        localStorage.setItem("mc-lang", l);
      } catch {
        /* ignore */
      }
    },
    [mode, lang] as const,
  );
}

const IGNORE = [/WebGL/i, /THREE\.WebGLRenderer/i, /Download the React DevTools/i, /reading 'tick'/];
function watchConsole(page: Page, errors: string[]) {
  page.on("console", (m) => {
    if (m.type() === "error" && !IGNORE.some((re) => re.test(m.text()))) errors.push(m.text());
  });
  page.on("pageerror", (e) => {
    if (!IGNORE.some((re) => re.test(e.message))) errors.push(e.message);
  });
}

async function gotoDashboard(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Claude Mission Control" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("connection-status")).toHaveAttribute("data-state", "connected", { timeout: 15_000 });
}

// Every read route the widgets depend on must respond (degrade-to-empty, never 5xx).
const READ_ROUTES = [
  "/api/health", "/api/sessions", "/api/events", "/api/graph", "/api/usage", "/api/usage/projects",
  "/api/usage/sessions", "/api/activity", "/api/anomaly", "/api/budget", "/api/calendar", "/api/compactions",
  "/api/errors", "/api/files", "/api/git/branches", "/api/mcp", "/api/prompts", "/api/reliability",
  "/api/sankey", "/api/search?q=read", "/api/session-duration", "/api/stats", "/api/streak", "/api/subagents",
  "/api/tags", "/api/token-burn", "/api/tools", "/api/tools/latency", "/api/velocity", "/api/digest",
  "/api/metrics", "/api/openapi",
];

test("every read API route responds", async () => {
  const ctx = await playwrightRequest.newContext({ baseURL: BASE_URL });
  const bad: string[] = [];
  for (const route of READ_ROUTES) {
    const res = await ctx.get(route);
    if (!res.ok()) bad.push(`${route} → ${res.status()}`);
  }
  await ctx.dispose();
  expect(bad, `non-OK routes:\n${bad.join("\n")}`).toEqual([]);
});

test("language toggle switches the whole UI (de ↔ en)", async ({ page }) => {
  const errors: string[] = [];
  watchConsole(page, errors);
  await prime(page, "dark", "de");
  await gotoDashboard(page);

  // Witness the language switch on the footer tagline: it's unique, language-specific
  // and always rendered (the header subtitle truncates when the bar is crowded).
  const langGroup = page.getByRole("group", { name: "Language" });
  await expect(langGroup.getByRole("button", { name: "de" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Lokales, read-only Dashboard für Claude Code.")).toBeVisible();

  await langGroup.getByRole("button", { name: "en" }).click();
  await expect(langGroup.getByRole("button", { name: "en" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Local, read-only dashboard for Claude Code.")).toBeVisible();

  expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
});

test("theme toggle flips data-theme (dark ↔ light)", async ({ page }) => {
  const errors: string[] = [];
  watchConsole(page, errors);
  await prime(page, "dark", "de");
  await gotoDashboard(page);

  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-theme", "dark");

  // Open the theme popover once; the tabs stay visible after a pick.
  await page.getByRole("button", { name: "Design" }).click();
  await page.getByRole("button", { name: "Hell" }).click(); // light
  await expect(html).toHaveAttribute("data-theme", "light");

  await page.getByRole("button", { name: "Dunkel" }).click(); // back to dark
  await expect(html).toHaveAttribute("data-theme", "dark");

  expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
});

test("global search filters the widgets", async ({ page }) => {
  const errors: string[] = [];
  watchConsole(page, errors);
  await prime(page, "dark", "de");
  await gotoDashboard(page);

  const card = page.getByRole("button").filter({ hasText: MARKER }).first();
  await expect(card).toBeVisible({ timeout: 15_000 });

  const search = page.locator('input[type="search"]');
  await search.fill("zzz-no-such-term");
  await expect(card).toHaveCount(0); // kanban (and other query-aware widgets) filtered

  await search.fill("");
  await expect(page.getByRole("button").filter({ hasText: MARKER }).first()).toBeVisible();

  expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
});

test("info hints are present across the dashboard", async ({ page }) => {
  const errors: string[] = [];
  watchConsole(page, errors);
  await prime(page, "dark", "de");
  await gotoDashboard(page);
  // One ℹ️ tooltip per panel (plus the header) — the whole grid is annotated.
  expect(await page.locator('[role="tooltip"]').count()).toBeGreaterThanOrEqual(20);
  expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
});

test("layout: resizing a widget surfaces reset, which restores the default", async ({ page }) => {
  const errors: string[] = [];
  watchConsole(page, errors);
  await prime(page, "dark", "de");
  await gotoDashboard(page);

  const resetBtn = page.getByRole("button", { name: "Layout zurücksetzen" });
  await expect(resetBtn).toHaveCount(0); // default layout → no reset affordance

  // Reveal a widget's toolbar and bump its width → custom layout.
  const widget = page.locator("#mc-widget-kpi-bar");
  await widget.scrollIntoViewIfNeeded();
  await widget.hover();
  await widget.getByRole("button", { name: "Breite ändern" }).click();

  await expect(resetBtn).toBeVisible();
  await resetBtn.click();
  await expect(resetBtn).toHaveCount(0); // restored

  expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
});

// Final sweep: a few full-dashboard screenshots (de/en × dark/light) as the
// Run 119c "Abschluss-Sammlung" artifact, under a clean-console gate.
for (const mode of ["dark", "light"] as const) {
  for (const lang of ["de", "en"] as const) {
    const label = `desktop-${mode}-${lang}`;
    test(`dashboard overview — ${label}`, async ({ page }, testInfo) => {
      const errors: string[] = [];
      watchConsole(page, errors);
      await page.setViewportSize({ width: 1440, height: 900 });
      await prime(page, mode, lang);
      await gotoDashboard(page);
      await page.waitForTimeout(1200);
      const shot = await page.screenshot({ path: `test-results/global-shots/${label}.png`, fullPage: false });
      await testInfo.attach(label, { body: shot, contentType: "image/png" });
      expect(errors, `console errors (${label}):\n${errors.join("\n")}`).toEqual([]);
    });
  }
}
