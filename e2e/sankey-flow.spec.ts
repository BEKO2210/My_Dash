import { test, expect, type Page } from "@playwright/test";

// Run 116 — sankey-flow (project → tool → kind flow) + tag-cloud (frequent prompt
// terms). sankey reads /api/sankey, tag-cloud /api/tags; both stubbed per page so
// nodes/links/labels, the Other bucket, term sizes and click-to-search are
// deterministic and the screenshots reproducible. The build/extract maths is
// unit-tested in src/lib/{sankey,tags}.test.ts.
const SANKEY = {
  nodes: [
    { name: "my_dash" }, { name: "shopify-bot" }, { name: "Other" },
    { name: "Read" }, { name: "Edit" }, { name: "Bash" },
    { name: "file" }, { name: "command" }, { name: "url" },
  ],
  links: [
    { source: 0, target: 3, value: 10 },
    { source: 0, target: 4, value: 6 },
    { source: 1, target: 5, value: 5 },
    { source: 2, target: 5, value: 3 },
    { source: 3, target: 6, value: 10 },
    { source: 4, target: 6, value: 6 },
    { source: 5, target: 7, value: 8 },
  ],
};
const TAGS = {
  terms: [
    { term: "dashboard", count: 20 }, { term: "widget", count: 16 }, { term: "refactor", count: 12 },
    { term: "tooltip", count: 9 }, { term: "sankey", count: 7 }, { term: "audit", count: 6 },
    { term: "theme", count: 5 }, { term: "hover", count: 3 }, { term: "empty", count: 2 },
  ],
};

async function stub(page: Page, sankey: object = SANKEY, tags: object = TAGS) {
  await page.route("**/api/sankey", (route) => route.fulfill({ json: sankey }));
  await page.route("**/api/tags*", (route) => route.fulfill({ json: tags }));
  await page.route("**/api/search*", (route) => route.fulfill({ json: { hits: [] } }));
}

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

// The full dashboard renders here, so tolerate noise from other widgets: 3D-graph
// WebGL info, the React DevTools nudge, and recharts' transient "reading 'tick'"
// while a chart's ResponsiveContainer settles on first paint (as layout.spec does).
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
  await expect(page.getByTestId("connection-status")).toHaveAttribute("data-state", "connected", { timeout: 15_000 });
}

const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 },
  { name: "qhd", width: 2560, height: 1440 },
  { name: "uhd", width: 3840, height: 2160 },
] as const;
const MODES = ["dark", "light"] as const;

function visualMatrix(widgetId: string, dir: string) {
  for (const vp of VIEWPORTS) {
    for (const mode of MODES) {
      const langs: ("de" | "en")[] = vp.name === "desktop" ? ["de", "en"] : ["de"];
      for (const lang of langs) {
        const label = `${vp.name}-${mode}-${lang}`;
        test(`${dir} visual — ${label}`, async ({ page }, testInfo) => {
          const errors: string[] = [];
          watchConsole(page, errors);
          await stub(page);
          await page.setViewportSize({ width: vp.width, height: vp.height });
          await prime(page, mode, lang);
          await gotoDashboard(page);
          const w = page.locator(`#mc-widget-${widgetId}`);
          await w.scrollIntoViewIfNeeded();
          await expect(w).toBeVisible();
          await page.waitForTimeout(900);
          const shot = await w.screenshot({ path: `test-results/${dir}-shots/${label}.png` });
          await testInfo.attach(label, { body: shot, contentType: "image/png" });
          expect(errors, `console errors (${label}):\n${errors.join("\n")}`).toEqual([]);
        });
      }
    }
  }
}

// ── sankey-flow ──────────────────────────────────────────────────────────────
const skOf = (page: Page) => page.locator("#mc-widget-sankey-flow");

test("sankey: nodes, links, Other bucket, readable labels in both themes", async ({ page }) => {
  const errors: string[] = [];
  watchConsole(page, errors);
  await stub(page);
  await prime(page, "light", "de");
  await gotoDashboard(page);
  const w = skOf(page);
  await w.scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);

  // Nodes (one rect each) and links (paths) render.
  await expect(w.locator(".recharts-surface rect")).toHaveCount(SANKEY.nodes.length);
  expect(await w.locator(".recharts-sankey-link").count()).toBe(SANKEY.links.length);

  // Tier labels, including the merged "Other" bucket.
  await expect(w.getByText("my_dash (16)")).toBeVisible();
  await expect(w.getByText("Read (10)")).toBeVisible();
  await expect(w.getByText("file (16)")).toBeVisible();
  await expect(w.getByText("Other (3)")).toBeVisible();

  // Label readability on the light theme: the node labels use the theme muted
  // colour (rgb(88, 96, 116)), not the old near-white hard-coded #aab3c5 that was
  // unreadable on the white panel.
  const fill = await w.locator(".recharts-surface text").first().evaluate((e) => getComputedStyle(e).fill);
  expect(fill).toBe("rgb(88, 96, 116)");

  expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
});

test("sankey: empty state when there are no tool targets", async ({ page }) => {
  const errors: string[] = [];
  watchConsole(page, errors);
  await stub(page, { nodes: [], links: [] });
  await prime(page, "dark", "de");
  await gotoDashboard(page);
  const w = skOf(page);
  await w.scrollIntoViewIfNeeded();
  await expect(w.getByText("Noch keine Tool-Ziele.")).toBeVisible();
  await expect(w.locator(".recharts-surface")).toHaveCount(0);
  expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
});

visualMatrix("sankey-flow", "sankey-flow");

// ── tag-cloud ────────────────────────────────────────────────────────────────
const tcOf = (page: Page) => page.locator("#mc-widget-tag-cloud");

test("tag-cloud: term sizes scale by frequency, click sets the global search", async ({ page }) => {
  const errors: string[] = [];
  watchConsole(page, errors);
  await stub(page);
  await prime(page, "dark", "de");
  await gotoDashboard(page);
  const w = tcOf(page);
  await w.scrollIntoViewIfNeeded();

  // Every term is a clickable chip.
  await expect(w.getByRole("button", { name: "dashboard" })).toBeVisible();

  // Frequency drives size: the most frequent term is larger than the least.
  const px = (name: string) =>
    w.getByRole("button", { name }).evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
  expect(await px("dashboard")).toBeGreaterThan(await px("empty"));

  // Click a term → the global search is set to it, and the cloud filters down.
  await w.getByRole("button", { name: "refactor" }).click();
  await expect(page.locator('input[type="search"]')).toHaveValue("refactor");
  await expect(w.getByRole("button", { name: "refactor" })).toBeVisible();
  await expect(w.getByRole("button", { name: "dashboard" })).toHaveCount(0);

  expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
});

test("tag-cloud: empty state when there are no terms", async ({ page }) => {
  const errors: string[] = [];
  watchConsole(page, errors);
  await stub(page, SANKEY, { terms: [] });
  await prime(page, "dark", "de");
  await gotoDashboard(page);
  const w = tcOf(page);
  await w.scrollIntoViewIfNeeded();
  await expect(w.getByText("Noch keine Begriffe.")).toBeVisible();
  // Term chips carry an inline font-size; the cell's drag/resize toolbar buttons do not.
  await expect(w.locator('button[style*="font-size"]')).toHaveCount(0);
  expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
});

visualMatrix("tag-cloud", "tag-cloud");
