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

export interface UsageReport {
  days: UsageDay[];
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

const TTL_MS = 30_000;
let cache: { at: number; report: UsageReport } | null = null;

function eurRate(): number {
  const r = Number(process.env.EUR_PER_USD);
  return Number.isFinite(r) && r > 0 ? r : 0.92;
}

function empty(): UsageReport {
  return {
    days: [],
    totals: { inputTokens: 0, outputTokens: 0, cacheTokens: 0, totalTokens: 0, costUsd: 0, costEur: 0 },
    available: false,
  };
}

export async function getUsage(): Promise<UsageReport> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.report;

  const rate = eurRate();
  try {
    const bin = path.join(process.cwd(), "node_modules", ".bin", "ccusage");
    const { stdout } = await execFileAsync(bin, ["daily", "--json"], {
      timeout: 20_000,
      maxBuffer: 16 * 1024 * 1024,
    });
    const parsed = JSON.parse(stdout) as { daily?: CcusageDaily[] };
    const rows = parsed.daily ?? [];

    const days: UsageDay[] = rows.map((d) => {
      const cache = (d.cacheCreationTokens ?? 0) + (d.cacheReadTokens ?? 0);
      const costUsd = d.totalCost ?? 0;
      return {
        date: d.period ?? "",
        inputTokens: d.inputTokens ?? 0,
        outputTokens: d.outputTokens ?? 0,
        cacheTokens: cache,
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

    const report: UsageReport = { days, totals, available: true };
    cache = { at: Date.now(), report };
    return report;
  } catch {
    // ccusage missing / offline / no Claude data — degrade gracefully.
    const report = empty();
    cache = { at: Date.now(), report };
    return report;
  }
}
