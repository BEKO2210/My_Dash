import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// Read routes must degrade to a defined response, never 5xx. Force the underlying
// collectors to throw and assert the metrics/digest GETs still answer 200; and
// assert the single-resource [id] routes return 400 (bad id) / 404 (missing).
vi.mock("@/lib/prometheus", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/prometheus")>()),
  collectMetrics: () => {
    throw new Error("boom");
  },
}));
vi.mock("@/lib/digest", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/digest")>()),
  buildDigest: () => {
    throw new Error("boom");
  },
}));

type RouteGet = (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
let metricsGet: () => Promise<Response>;
let digestGet: (req: Request) => Promise<Response>;
let eventsIdGet: RouteGet;
let toolCallsIdGet: RouteGet;
let dataDir: string;

beforeAll(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), "mc-errorcontract-test-"));
  process.env.MC_DATA_DIR = dataDir;
  await import("@/lib/db"); // init schema on the temp db
  metricsGet = (await import("@/app/api/metrics/route")).GET;
  digestGet = (await import("@/app/api/digest/route")).GET;
  eventsIdGet = (await import("@/app/api/events/[id]/route")).GET as RouteGet;
  toolCallsIdGet = (await import("@/app/api/tool-calls/[id]/route")).GET as RouteGet;
});

afterAll(() => {
  rmSync(dataDir, { recursive: true, force: true });
  delete process.env.MC_DATA_DIR;
});

describe("read-route error contract", () => {
  it("#25 /api/metrics degrades to a 200 scrape when collection fails", async () => {
    const res = await metricsGet();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/plain");
    expect(await res.text()).toContain("mc_up 0");
  });

  it("#28 /api/digest degrades to a 200 (valid empty) digest when build fails", async () => {
    const json = await digestGet(new Request("http://x/api/digest?format=json"));
    expect(json.status).toBe(200);
    expect(await json.json()).toMatchObject({ events: 0, sessions: 0, topTools: [] });

    const html = await digestGet(new Request("http://x/api/digest"));
    expect(html.status).toBe(200);
    expect(html.headers.get("Content-Type")).toContain("text/html");
  });

  it("#26 /api/events/[id] returns 400 for a bad id and 404 when missing", async () => {
    expect((await eventsIdGet(new Request("http://x"), { params: Promise.resolve({ id: "abc" }) })).status).toBe(400);
    expect((await eventsIdGet(new Request("http://x"), { params: Promise.resolve({ id: "999999" }) })).status).toBe(404);
  });

  it("#27 /api/tool-calls/[id] returns 400 for a bad id and 404 when missing", async () => {
    expect((await toolCallsIdGet(new Request("http://x"), { params: Promise.resolve({ id: "0" }) })).status).toBe(400);
    expect((await toolCallsIdGet(new Request("http://x"), { params: Promise.resolve({ id: "999999" }) })).status).toBe(404);
  });
});
