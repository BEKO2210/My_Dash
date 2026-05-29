import { test, expect, request as playwrightRequest, type APIRequestContext, type Page } from "@playwright/test";

const BASE_URL = "http://127.0.0.1:3100";
const PROJECT = "layout-bot";

// Seed a little data through the only write path so panels render populated states.
async function seed() {
  const ctx: APIRequestContext = await playwrightRequest.newContext({ baseURL: BASE_URL });
  const base = { session_id: `layout-${Date.now()}`, cwd: `/home/user/projects/${PROJECT}` };
  const post = (event: string, payload: Record<string, unknown>) =>
    ctx.post("/api/ingest", {
      headers: { "X-Hook-Event": event, "Content-Type": "application/json" },
      data: { ...payload, hook_event_name: event },
    });
  await post("SessionStart", { ...base, source: "startup" });
  await post("UserPromptSubmit", { ...base, prompt: "Layout audit prompt" });
  await post("PostToolUse", { ...base, tool_name: "Read", tool_input: { file_path: "/x.ts" }, tool_response: { ok: true } });
  await post("Stop", { ...base });
  await ctx.dispose();
}

test.beforeAll(seed);

// Force a deterministic theme/lang and skip the first-run wizard before any script runs.
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

// Browser console noise we explicitly tolerate: WebGL backends occasionally emit
// info/warnings from the 3D graph under headless GPU, and recharts can throw a
// transient internal "reading 'tick'" while its ResponsiveContainer settles its
// size on first paint (the chart renders fine; the error is intermittent).
const IGNORE = [/WebGL/i, /THREE\.WebGLRenderer/i, /Download the React DevTools/i, /reading 'tick'/];

const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 },
  { name: "qhd", width: 2560, height: 1440 },
  { name: "uhd", width: 3840, height: 2160 },
] as const;

const MODES = ["dark", "light"] as const;

for (const vp of VIEWPORTS) {
  for (const mode of MODES) {
    // German for every breakpoint+theme; one English pass at desktop to catch
    // translation-length overflow.
    const langs: ("de" | "en")[] = vp.name === "desktop" ? ["de", "en"] : ["de"];
    for (const lang of langs) {
      const label = `${vp.name}-${mode}-${lang}`;
      test(`layout: no overflow, clean console — ${label}`, async ({ page }, testInfo) => {
        const errors: string[] = [];
        page.on("console", (m) => {
          if (m.type() === "error" && !IGNORE.some((re) => re.test(m.text()))) errors.push(m.text());
        });
        page.on("pageerror", (e) => {
          if (!IGNORE.some((re) => re.test(e.message))) errors.push(e.message);
        });

        await page.setViewportSize({ width: vp.width, height: vp.height });
        await prime(page, mode, lang);
        await page.goto("/");
        await expect(page.getByRole("heading", { name: "Claude Mission Control" })).toBeAttached({ timeout: 15_000 });
        // The SSE stream keeps the network busy, so "networkidle" never fires —
        // wait for the live connection instead, then let charts/animations settle.
        await expect(page.getByTestId("connection-status")).toHaveAttribute("data-state", "connected", {
          timeout: 15_000,
        });
        await page.waitForTimeout(800);

        // No horizontal overflow at any breakpoint.
        const overflow = await page.evaluate(() => {
          const el = document.scrollingElement || document.documentElement;
          return el.scrollWidth - el.clientWidth;
        });
        expect(overflow, `horizontal overflow (${label})`).toBeLessThanOrEqual(1);

        // Collect a screenshot as a CI artifact for visual review.
        const shot = await page.screenshot({ path: `test-results/layout-shots/${label}.png`, fullPage: false });
        await testInfo.attach(label, { body: shot, contentType: "image/png" });

        expect(errors, `console errors (${label}):\n${errors.join("\n")}`).toEqual([]);
      });
    }
  }
}
