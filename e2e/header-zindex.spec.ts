import { test, expect, type Page } from "@playwright/test";

// Regression guard: header dropdowns/popovers (theme picker, search results, …)
// open downward over the first widget row. The header has backdrop-blur (its own
// stacking context); without an elevated z-index the whole header subtree — and
// thus its popovers — painted *below* the grid, so the lower part of a popover sat
// behind the tiles and was not clickable. The header now sits at `relative z-40`,
// above the grid. These tests assert popover content that overlaps a widget is the
// topmost element (and clickable), in both themes.

function prime(page: Page, mode: "dark" | "light") {
  return page.addInitScript((m) => {
    try {
      localStorage.setItem("mc-onboarded", "1");
      localStorage.setItem("mc-theme", JSON.stringify({ mode: m, accent: "#4f8cff" }));
      localStorage.setItem("mc-lang", "de");
    } catch {
      /* ignore */
    }
  }, mode);
}

async function gotoDashboard(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Claude Mission Control" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("connection-status")).toHaveAttribute("data-state", "connected", { timeout: 15_000 });
}

// Is the element at the centre of `box` the expected node (not a widget tile)?
async function topmostAt(page: Page, box: { x: number; y: number; width: number; height: number }) {
  return page.evaluate(
    ({ x, y }) => {
      const el = document.elementFromPoint(x, y) as HTMLElement | null;
      return {
        overWidget: el?.closest('[id^="mc-widget-"]')?.id ?? null,
        aria: el?.getAttribute("aria-label") ?? null,
        inLink: !!el?.closest('a[href^="/session"]'),
      };
    },
    { x: box.x + box.width / 2, y: box.y + box.height / 2 },
  );
}

for (const mode of ["dark", "light"] as const) {
  test(`theme popover accent swatch is on top of the grid + clickable — ${mode}`, async ({ page }) => {
    await prime(page, mode);
    await gotoDashboard(page);

    // The KPI bar is the first widget, directly under the header.
    const kpi = await page.locator("#mc-widget-kpi-bar").boundingBox();
    expect(kpi).not.toBeNull();

    await page.getByRole("button", { name: "Design" }).click(); // open theme popover
    const swatch = page.getByRole("button", { name: "#4f8cff" }).first();
    const sb = await swatch.boundingBox();
    expect(sb).not.toBeNull();

    // The swatch must actually overlap the KPI widget (otherwise the test is moot).
    if (sb && kpi) expect(sb.y).toBeGreaterThan(kpi.y);

    // It must be the topmost element there — not covered by the tile.
    const hit = await topmostAt(page, sb!);
    expect(hit.overWidget).toBeNull();
    expect(hit.aria).toBe("#4f8cff");

    // And actually clickable (would throw "intercepts pointer events" if behind).
    await swatch.click();
  });
}

test("search results dropdown is on top of the grid", async ({ page }) => {
  await prime(page, "dark");
  await page.route("**/api/search*", (route) =>
    route.fulfill({
      json: { hits: Array.from({ length: 8 }, (_, i) => ({ kind: "prompt", ref_id: i, session_id: `s${i}`, text: `search hit ${i}` })) },
    }),
  );
  await gotoDashboard(page);

  await page.locator('input[type="search"]').fill("hit");
  const links = page.locator('a[href^="/session?id="]');
  await expect(links.first()).toBeVisible();

  // The deepest result extends well into the widget area; it must stay on top.
  const last = await links.last().boundingBox();
  expect(last).not.toBeNull();
  const hit = await topmostAt(page, last!);
  expect(hit.overWidget).toBeNull();
  expect(hit.inLink).toBe(true);
});
