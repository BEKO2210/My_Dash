import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface UsageDay {
  date: string;
  inputTokens: number;
  outputTokens: number;
  cacheTokens: number;
  totalTokens: number;
  costUsd: number;
  costEur: number;
}

// A ccusage 5-hour billing block within the last 24h (finest granularity ccusage offers).
export interface UsageBlock {
  start: string; // ISO start time
  isActive: boolean;
  inputTokens: number;
  outputTokens: number;
  cacheTokens: number;
  totalTokens: number;
  costUsd: number;
  costEur: number;
}

export interface UsageReport {
  days: UsageDay[];
  blocks: UsageBlock[]; // last 24h, 5h buckets
  totals: {
    inputTokens: number;
    outputTokens: number;
    cacheTokens: number;
    totalTokens: number;
    costUsd: number;
    costEur: number;
  };
  available: boolean; // false when ccusage couldn't run (offline / no data)
}

interface CcusageDaily {
  period?: string;
  inputTokens?: number;
  outputTokens?: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
  totalTokens?: number;
  totalCost?: number;
}

interface CcusageBlock {
  startTime?: string;
  endTime?: string;
  isActive?: boolean;
  isGap?: boolean;
  costUSD?: number;
  totalTokens?: number;
  tokenCounts?: {
    inputTokens?: number;
    outputTokens?: number;
    cacheCreationInputTokens?: number;
    cacheReadInputTokens?: number;
  };
}

const TTL_MS = 30_000;
let cache: { at: number; report: UsageReport } | null = null;

function eurRate(): number {
  const r = Number(process.env.EUR_PER_USD);
  return Number.isFinite(r) && r > 0 ? r : 0.92;
}

function empty(): UsageReport {
  return {
    days: [],
    blocks: [],
    totals: { inputTokens: 0, outputTokens: 0, cacheTokens: 0, totalTokens: 0, costUsd: 0, costEur: 0 },
    available: false,
  };
}

export async function getUsage(): Promise<UsageReport> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.report;

  const rate = eurRate();
  const bin = path.join(process.cwd(), "node_modules", ".bin", "ccusage");
  const run = (cmd: string) =>
    execFileAsync(bin, [cmd, "--json"], { timeout: 20_000, maxBuffer: 16 * 1024 * 1024 });

  try {
    // Daily (multi-day chart) + blocks (last-24h view) in parallel. Blocks are
    // best-effort — a failure there still yields the daily report.
    const [dailyRes, blocksRes] = await Promise.allSettled([run("daily"), run("blocks")]);

    if (dailyRes.status !== "fulfilled") throw new Error("ccusage daily failed");

    const parsed = JSON.parse(dailyRes.value.stdout) as { daily?: CcusageDaily[] };
    const rows = parsed.daily ?? [];

    const days: UsageDay[] = rows.map((d) => {
      const cacheTokens = (d.cacheCreationTokens ?? 0) + (d.cacheReadTokens ?? 0);
      const costUsd = d.totalCost ?? 0;
      return {
        date: d.period ?? "",
        inputTokens: d.inputTokens ?? 0,
        outputTokens: d.outputTokens ?? 0,
        cacheTokens,
        totalTokens: d.totalTokens ?? 0,
        costUsd,
        costEur: costUsd * rate,
      };
    });

    const totals = days.reduce(
      (acc, d) => {
        acc.inputTokens += d.inputTokens;
        acc.outputTokens += d.outputTokens;
        acc.cacheTokens += d.cacheTokens;
        acc.totalTokens += d.totalTokens;
        acc.costUsd += d.costUsd;
        acc.costEur += d.costEur;
        return acc;
      },
      { inputTokens: 0, outputTokens: 0, cacheTokens: 0, totalTokens: 0, costUsd: 0, costEur: 0 },
    );

    let blocks: UsageBlock[] = [];
    if (blocksRes.status === "fulfilled") {
      const since = Date.now() - 24 * 60 * 60 * 1000;
      const parsedBlocks = JSON.parse(blocksRes.value.stdout) as { blocks?: CcusageBlock[] };
      blocks = (parsedBlocks.blocks ?? [])
        .filter((b) => {
          if (b.isGap || !b.startTime) return false;
          const end = Date.parse(b.endTime ?? b.startTime);
          return Number.isFinite(end) && end >= since;
        })
        .map((b) => {
          const tc = b.tokenCounts ?? {};
          const input = tc.inputTokens ?? 0;
          const output = tc.outputTokens ?? 0;
          const cacheTokens = (tc.cacheCreationInputTokens ?? 0) + (tc.cacheReadInputTokens ?? 0);
          const costUsd = b.costUSD ?? 0;
          return {
            start: b.startTime as string,
            isActive: !!b.isActive,
            inputTokens: input,
            outputTokens: output,
            cacheTokens,
            totalTokens: b.totalTokens ?? input + output + cacheTokens,
            costUsd,
            costEur: costUsd * rate,
          };
        });
    }

    const report: UsageReport = { days, blocks, totals, available: true };
    cache = { at: Date.now(), report };
    return report;
  } catch {
    // ccusage missing / offline / no Claude data — degrade gracefully.
    const report = empty();
    cache = { at: Date.now(), report };
    return report;
  }
}
