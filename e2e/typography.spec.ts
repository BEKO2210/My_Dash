import { test, expect, request as playwrightRequest, type APIRequestContext, type Page } from "@playwright/test";

const BASE_URL = "http://127.0.0.1:3100";

// Pathological strings: a very long unbroken token (worst case for truncation) plus
// a long, space-separated sentence (worst case for wrapping / translation length).
const LONG_TOKEN = "Supercalifragilistic" + "x".repeat(220);
const LONG_SENTENCE =
  "Refaktoriere den kompletten Authentifizierungs- und Autorisierungs-Stack inklusive aller Randfälle " +
  "und schreibe ausführliche Integrationstests für jede einzelne Route " +
  LONG_TOKEN;
const LONG_PROJECT = "projekt-" + "a".repeat(200);
const LONG_FILE = "/home/user/projects/" + LONG_PROJECT + "/src/" + "b".repeat(200) + ".tsx";

async function seed() {
  const ctx: APIRequestContext = await playwrightRequest.newContext({ baseURL: BASE_URL });
  const base = { session_id: `typo-${Date.now()}`, cwd: `/home/user/projects/${LONG_PROJECT}` };
  const post = (event: string, payload: Record<string, unknown>) =>
    ctx.post("/api/ingest", {
      headers: { "X-Hook-Event": event, "Content-Type": "application/json" },
      data: { ...payload, hook_event_name: event },
    });
  await post("SessionStart", { ...base, source: "startup" });
  await post("UserPromptSubmit", { ...base, prompt: LONG_SENTENCE });
  await post("PreToolUse", { ...base, tool_name: "Edit", tool_input: { file_path: LONG_FILE } });
  await post("PostToolUse", { ...base, tool_name: "Edit", tool_input: { file_path: LONG_FILE }, tool_response: { ok: true } });
  await post("Stop", { ...base });
  await ctx.dispose();
}

test.beforeAll(seed);

function prime(page: Page, lang: "de" | "en") {
  return page.addInitScript((l) => {
    try {
      localStorage.setItem("mc-onboarded", "1");
      localStorage.setItem("mc-lang", l);
    } catch {
      /* ignore */
    }
  }, lang);
}

for (const vp of [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 },
  { name: "qhd", width: 2560, height: 1440 },
] as const) {
  for (const lang of ["de", "en"] as const) {
    test(`long text does not break the layout — ${vp.name}-${lang}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await prime(page, lang);
      await page.goto("/");
      await expect(page.getByTestId("connection-status")).toHaveAttribute("data-state", "connected", {
        timeout: 15_000,
      });
      await page.waitForTimeout(500);

      const result = await page.evaluate(() => {
        const el = document.scrollingElement || document.documentElement;
        const overflow = el.scrollWidth - el.clientWidth;
        const offenders: string[] = [];
        if (overflow > 1) {
          const w = window.innerWidth;
          for (const node of Array.from(document.querySelectorAll<HTMLElement>("*"))) {
            const r = node.getBoundingClientRect();
            if (r.right > w + 1 && r.width > 0 && r.width <= el.scrollWidth) {
              offenders.push(`${node.tagName}.${node.className?.toString().slice(0, 80)} | ${node.textContent?.slice(0, 40)}`);
              if (offenders.length >= 8) break;
            }
          }
        }
        return { overflow, offenders };
      });
      expect(
        result.overflow,
        `horizontal overflow (${vp.name}-${lang}):\n${result.offenders.join("\n")}`,
      ).toBeLessThanOrEqual(1);
    });
  }
}
