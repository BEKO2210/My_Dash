import { afterEach, describe, expect, it } from "vitest";
import {
  buildReport,
  empty,
  eurRate,
  mapBlockRows,
  mapDailyRows,
  type CcusageBlock,
  type CcusageDaily,
} from "@/lib/ccusage";

const NOW = Date.parse("2026-05-23T12:00:00Z");

describe("mapDailyRows", () => {
  it("maps a full row and converts cost to EUR", () => {
    const rows: CcusageDaily[] = [
      {
        period: "2026-05-23",
        inputTokens: 100,
        outputTokens: 200,
        cacheCreationTokens: 30,
        cacheReadTokens: 70,
        totalTokens: 400,
        totalCost: 2,
      },
    ];
    expect(mapDailyRows(rows, 0.5)).toEqual([
      {
        date: "2026-05-23",
        inputTokens: 100,
        outputTokens: 200,
        cacheTokens: 100, // creation + read
        totalTokens: 400,
        costUsd: 2,
        costEur: 1, // 2 * 0.5
      },
    ]);
  });

  it("defaults every missing field to 0", () => {
    expect(mapDailyRows([{}], 0.92)).toEqual([
      {
        date: "",
        inputTokens: 0,
        outputTokens: 0,
        cacheTokens: 0,
        totalTokens: 0,
        costUsd: 0,
        costEur: 0,
      },
    ]);
  });

  it("returns an empty array for no rows", () => {
    expect(mapDailyRows([], 0.92)).toEqual([]);
  });
});

describe("mapBlockRows", () => {
  const recent: CcusageBlock = {
    startTime: "2026-05-23T10:00:00Z",
    endTime: "2026-05-23T11:00:00Z",
    isActive: true,
    costUSD: 4,
    tokenCounts: {
      inputTokens: 10,
      outputTokens: 20,
      cacheCreationInputTokens: 5,
      cacheReadInputTokens: 5,
    },
  };

  it("maps a recent block, summing cache tokens and converting cost", () => {
    const [b] = mapBlockRows([recent], 0.5, NOW);
    expect(b).toMatchObject({
      start: "2026-05-23T10:00:00Z",
      isActive: true,
      inputTokens: 10,
      outputTokens: 20,
      cacheTokens: 10,
      totalTokens: 40, // fallback: input + output + cache
      costUsd: 4,
      costEur: 2,
    });
  });

  it("prefers an explicit totalTokens over the fallback sum", () => {
    expect(mapBlockRows([{ ...recent, totalTokens: 999 }], 0.5, NOW)[0].totalTokens).toBe(999);
  });

  it("drops gap blocks, undated blocks and blocks older than 24h", () => {
    const old: CcusageBlock = { startTime: "2026-05-21T10:00:00Z", endTime: "2026-05-21T11:00:00Z" };
    const gap: CcusageBlock = { ...recent, isGap: true };
    const undated: CcusageBlock = { costUSD: 1 };
    expect(mapBlockRows([recent, old, gap, undated], 0.92, NOW)).toHaveLength(1);
  });
});

describe("buildReport", () => {
  it("sums totals across days and includes mapped blocks", () => {
    const daily: CcusageDaily[] = [
      { period: "d1", inputTokens: 1, outputTokens: 2, totalTokens: 3, totalCost: 1 },
      { period: "d2", inputTokens: 4, outputTokens: 8, totalTokens: 12, totalCost: 3 },
    ];
    const blocks: CcusageBlock[] = [{ startTime: "2026-05-23T10:00:00Z", costUSD: 1 }];
    const report = buildReport(daily, blocks, 1, NOW);

    expect(report.available).toBe(true);
    expect(report.days).toHaveLength(2);
    expect(report.blocks).toHaveLength(1);
    expect(report.totals).toMatchObject({
      inputTokens: 5,
      outputTokens: 10,
      totalTokens: 15,
      costUsd: 4,
      costEur: 4,
    });
  });

  it("treats null blocks (command unavailable) as an empty list but still reports daily", () => {
    const report = buildReport([{ period: "d1", totalCost: 1 }], null, 1, NOW);
    expect(report.available).toBe(true);
    expect(report.days).toHaveLength(1);
    expect(report.blocks).toEqual([]);
  });

  it("yields zeroed totals for no data", () => {
    const report = buildReport([], null, 0.92, NOW);
    expect(report.days).toEqual([]);
    expect(report.totals).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      cacheTokens: 0,
      totalTokens: 0,
      costUsd: 0,
      costEur: 0,
    });
  });
});

describe("empty", () => {
  it("is the graceful-degradation report (available=false)", () => {
    const e = empty();
    expect(e.available).toBe(false);
    expect(e.days).toEqual([]);
    expect(e.blocks).toEqual([]);
    expect(e.totals.totalTokens).toBe(0);
  });
});

describe("eurRate", () => {
  const original = process.env.EUR_PER_USD;
  afterEach(() => {
    if (original === undefined) delete process.env.EUR_PER_USD;
    else process.env.EUR_PER_USD = original;
  });

  it("defaults to 0.92 when unset or invalid", () => {
    delete process.env.EUR_PER_USD;
    expect(eurRate()).toBe(0.92);
    process.env.EUR_PER_USD = "not-a-number";
    expect(eurRate()).toBe(0.92);
    process.env.EUR_PER_USD = "-1";
    expect(eurRate()).toBe(0.92);
  });

  it("honours a valid override", () => {
    process.env.EUR_PER_USD = "0.8";
    expect(eurRate()).toBe(0.8);
  });
});
