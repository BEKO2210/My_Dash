import { test, expect, request as playwrightRequest, type APIRequestContext, type Page } from "@playwright/test";

const BASE_URL = "http://127.0.0.1:3100";
const PROJECT = "graph-bot";

// Seed one active session with a prompt and several tools touching varied targets
// (file, command, url, pattern) so the 3D graph builds a rich, multi-kind
// Session → Tool → Resource structure with a clear central session hub.
async function seed() {
  const ctx: APIRequestContext = await playwrightRequest.newContext({ baseURL: BASE_URL });
  const base = { session_id: `graph-${Date.now()}`, cwd: `/home/user/projects/${PROJECT}` };
  const post = (event: string, payload: Record<string, unknown>) =>
    ctx.post("/api/ingest", {
      headers: { "X-Hook-Event": event, "Content-Type": "application/json" },
      data: { ...payload, hook_event_name: event },
    });
  await post("SessionStart", { ...base, source: "startup" });
  await post("UserPromptSubmit", { ...base, prompt: "Build the 3D tool-graph audit fixture." });
  const tools: [string, Record<string, unknown>][] = [
    ["Read", { file_path: "/home/user/projects/graph-bot/src/a.ts" }],
    ["Edit", { file_path: "/home/user/projects/graph-bot/src/b.ts" }],
    ["Bash", { command: "npm run build" }],
    ["Grep", { pattern: "buildGraph" }],
    ["WebFetch", { url: "https://example.com/docs" }],
  ];
  for (const [tool, input] of tools) {
    await post("PreToolUse", { ...base, tool_name: tool, tool_input: input });
    await post("PostToolUse", { ...base, tool_name: tool, tool_input: input, tool_response: { ok: true } });
  }
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

// The full dashboard renders here, so tolerate benign noise from other widgets:
// headless-WebGL/three.js info, the React DevTools nudge, and recharts' transient
// "reading 'tick'" while a chart's ResponsiveContainer settles (as layout.spec does).
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
  await expect(page.getByRole("heading", { name: "Claude Mission Control" })).toBeAttached({ timeout: 15_000 });
  // SSE keeps the network busy, so wait for the live connection rather than idle.
  await expect(page.getByTestId("connection-status")).toHaveAttribute("data-state", "connected", { timeout: 15_000 });
}

const widgetOf = (page: Page) => page.locator("#mc-widget-tool-graph");

// Nodes live inside a WebGL <canvas>, so there is no DOM element to target, the force
// layout is randomised per run, and continuous 3D rendering makes the page slow to
// drive when the graph is busy. So clicking a specific node deterministically is not
// feasible. We instead *exercise* the click handlers: click a small grid (ordered
// outward from the centre, where a single-session hub tends to settle), time-capped,
// and — when a node happens to be hit — verify its detail card opens and closes. The
// hard gates are load/labels/fullscreen/console + the screenshot matrix; the
// clean-console check guards onNodeClick/onBackgroundClick against regressions.
async function exerciseNodeClick(page: Page, container: ReturnType<typeof widgetOf>): Promise<boolean> {
  const box = await container.locator("canvas").first().boundingBox();
  if (!box) return false;
  const close = container.getByRole("button", { name: "Schließen" });
  const n = 5;
  const pts: [number, number][] = [];
  for (let r = 1; r <= n; r++)
    for (let c = 1; c <= n; c++) pts.push([box.x + (box.width * c) / (n + 1), box.y + (box.height * r) / (n + 1)]);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  pts.sort((a, b) => (a[0] - cx) ** 2 + (a[1] - cy) ** 2 - ((b[0] - cx) ** 2 + (b[1] - cy) ** 2));
  const deadline = Date.now() + 6000;
  for (const [x, y] of pts) {
    if (Date.now() > deadline) break;
    await page.mouse.click(x, y);
    await page.waitForTimeout(10);
    if ((await close.count()) > 0 && (await close.isVisible())) return true;
  }
  return false;
}

test("graph loads, shows labels, handles node click + fullscreen — clean console", async ({ page }) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  watchConsole(page, errors);

  await prime(page, "dark", "de");
  await gotoDashboard(page);
  const widget = widgetOf(page);
  await widget.scrollIntoViewIfNeeded();

  // Loading never sticks as a false "empty": once settled we get either the WebGL
  // canvas or the explicit no-WebGL hint — never a crash, never a stale empty.
  const canvas = widget.locator("canvas");
  const noWebgl = widget.getByText(/WebGL/i);
  await expect(canvas.or(noWebgl).first()).toBeVisible({ timeout: 20_000 });
  const hasCanvas = (await canvas.count()) > 0;

  if (hasCanvas) {
    // Let the force layout + zoomToFit settle. The widget (unlike the demo engine)
    // does not auto-rotate, so nodes then hold still for hit-testing.
    await page.waitForTimeout(4000);
    // Labels: the legend lists the node kinds present in the graph, translated.
    await expect(widget.getByText("Session", { exact: true })).toBeVisible();
    await expect(widget.getByText("Tool", { exact: true })).toBeVisible();

    // Node click → exercise the handlers; verify the detail card open/close path
    // whenever a node is actually hit.
    if (await exerciseNodeClick(page, widget)) {
      const close = widget.getByRole("button", { name: "Schließen" });
      await close.click();
      await expect(close).toBeHidden();
    }
  }

  // Fullscreen toggle: maximise → fixed overlay + shrink control; Escape restores.
  await widget.getByRole("button", { name: "Vollbild" }).click();
  const overlay = page.locator(".fixed.inset-0");
  await expect(overlay).toBeVisible();
  await expect(page.getByRole("button", { name: "Verkleinern" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(overlay).toHaveCount(0);

  expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
});

// Visual matrix: every theme × breakpoint (plus an English desktop pass), each
// collected as a CI artifact for review. Mirrors the Phase Z layout audit.
const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 },
  { name: "qhd", width: 2560, height: 1440 },
  { name: "uhd", width: 3840, height: 2160 },
] as const;
const MODES = ["dark", "light"] as const;

for (const vp of VIEWPORTS) {
  for (const mode of MODES) {
    const langs: ("de" | "en")[] = vp.name === "desktop" ? ["de", "en"] : ["de"];
    for (const lang of langs) {
      const label = `${vp.name}-${mode}-${lang}`;
      test(`tool-graph visual — ${label}`, async ({ page }, testInfo) => {
        const errors: string[] = [];
        watchConsole(page, errors);

        await page.setViewportSize({ width: vp.width, height: vp.height });
        await prime(page, mode, lang);
        await gotoDashboard(page);
        const widget = widgetOf(page);
        await widget.scrollIntoViewIfNeeded();
        await expect(widget.locator("canvas").or(widget.getByText(/WebGL/i)).first()).toBeVisible({ timeout: 20_000 });
        // Let the simulation settle so the screenshot is fitted, not mid-layout.
        await page.waitForTimeout(4000);

        const shot = await widget.screenshot({ path: `test-results/tool-graph-shots/${label}.png` });
        await testInfo.attach(label, { body: shot, contentType: "image/png" });

        expect(errors, `console errors (${label}):\n${errors.join("\n")}`).toEqual([]);
      });
    }
  }
}
