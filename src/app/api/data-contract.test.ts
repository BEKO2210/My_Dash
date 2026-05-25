import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// Guard for the one-way data rule: read (GET) routes must never write to the DB —
// only /api/ingest does. We wrap db.prepare to flag any write SQL executed while a
// read route's handler runs, then exercise a set of GETs. This catches regressions
// of #1 (the budget GET used to INSERT a cost alarm). ccusage is mocked so the
// budget route neither execs a binary nor needs real Claude data — and it reports a
// spend far over budget, the exact condition that used to trigger the GET's write.
vi.mock("@/lib/ccusage", () => {
  const today = new Date().toISOString().slice(0, 10);
  const month = new Date().toISOString().slice(0, 7);
  const row = (date: string, costUsd: number) => ({
    date,
    inputTokens: 0,
    outputTokens: 0,
    cacheTokens: 0,
    totalTokens: 0,
    costUsd,
    costEur: 0,
  });
  const report = {
    days: [row(today, 999)],
    months: [row(month, 9999)],
    blocks: [],
    burn: null,
    models: [],
    totals: { inputTokens: 0, outputTokens: 0, cacheTokens: 0, totalTokens: 0, costUsd: 999, costEur: 0 },
    available: true,
  };
  return {
    getUsage: async () => report,
    getSessionUsage: async () => ({ sessions: [], available: false }),
    empty: () => ({ ...report, available: false }),
    eurRate: () => 0.92,
  };
});

type Handler = () => Promise<unknown>;
const writes: string[] = [];
let dataDir: string;
const routes: { name: string; get: Handler }[] = [];

beforeAll(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), "mc-datacontract-test-"));
  process.env.MC_DATA_DIR = dataDir;
  process.env.MC_BUDGET_DAILY = "1"; // tiny budget → mocked 999 spend is way over
  process.env.MC_BUDGET_MONTHLY = "1";

  const { db } = await import("@/lib/db");
  // Seed a little data so the read routes have something to aggregate.
  db.exec(
    "INSERT INTO sessions (id, project_name, cost_usd) VALUES ('s1','p',5); " +
      "INSERT INTO tool_calls (session_id, tool_name, success) VALUES ('s1','Read',1);",
  );

  // Import the route handlers BEFORE installing the spy (module-level prepares are
  // SELECTs anyway); the spy then catches any write prepared while a GET runs.
  routes.push({ name: "budget", get: (await import("@/app/api/budget/route")).GET as Handler });
  routes.push({ name: "sessions", get: (await import("@/app/api/sessions/route")).GET as Handler });
  routes.push({ name: "stats", get: (await import("@/app/api/stats/route")).GET as Handler });
  routes.push({ name: "sankey", get: (await import("@/app/api/sankey/route")).GET as Handler });
  routes.push({ name: "anomaly", get: (await import("@/app/api/anomaly/route")).GET as Handler });

  const origPrepare = db.prepare.bind(db);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (db as any).prepare = (sql: string) => {
    if (/^\s*(insert|update|delete|replace|drop|alter)\b/i.test(sql)) writes.push(sql);
    return origPrepare(sql);
  };
});

afterAll(() => {
  rmSync(dataDir, { recursive: true, force: true });
  delete process.env.MC_DATA_DIR;
  delete process.env.MC_BUDGET_DAILY;
  delete process.env.MC_BUDGET_MONTHLY;
});

describe("one-way data rule: read routes never write", () => {
  it("no GET handler prepares a write statement (covers the #1 budget regression)", async () => {
    for (const r of routes) {
      writes.length = 0;
      await r.get();
      expect(writes, `${r.name} GET must not write to the DB`).toEqual([]);
    }
  });
});
