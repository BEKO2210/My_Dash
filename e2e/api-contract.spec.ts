import { test, expect, request as playwrightRequest, type APIRequestContext } from "@playwright/test";

// #68 — API error-contract (integration level). Forge unit-tests the degrade logic
// (#25-28); this hits the real running server and asserts read routes return
// *defined* statuses: missing resources → 404, and read routes never 5xx (they
// degrade to an empty-but-valid 200) even with absent/garbage input.
const BASE_URL = "http://127.0.0.1:3100";

let ctx: APIRequestContext;
test.beforeAll(async () => {
  ctx = await playwrightRequest.newContext({ baseURL: BASE_URL });
});
test.afterAll(async () => {
  await ctx.dispose();
});

test("valid-but-missing resources return 404; malformed ids return 400 (never 500)", async () => {
  // Valid-format id that doesn't exist → 404.
  for (const url of ["/api/events/99999999", "/api/tool-calls/99999999"]) {
    const res = await ctx.get(url);
    expect(res.status(), `${url} → ${res.status()}`).toBe(404);
  }
  // Malformed id → a defined 400, not a 500.
  for (const url of ["/api/events/abc", "/api/tool-calls/abc"]) {
    const res = await ctx.get(url);
    expect(res.status(), `${url} → ${res.status()}`).toBe(400);
  }
});

test("read routes degrade to a valid 200, never 5xx", async () => {
  for (const url of ["/api/health", "/api/metrics", "/api/stats", "/api/events", "/api/sessions"]) {
    const res = await ctx.get(url);
    expect(res.status(), `${url} → ${res.status()}`).toBeLessThan(500);
    expect(res.status(), `${url} → ${res.status()}`).toBeGreaterThanOrEqual(200);
  }
});

test("garbage query params don't 500", async () => {
  for (const url of [
    "/api/sessions?limit=notanumber",
    "/api/events?limit=-5&offset=abc",
    "/api/search?q=",
    "/api/velocity?days=banana",
  ]) {
    const res = await ctx.get(url);
    expect(res.status(), `${url} → ${res.status()}`).toBeLessThan(500);
  }
});
