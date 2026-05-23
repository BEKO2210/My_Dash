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

// Aggregated usage for one model across the reporting window.
export interface UsageModel {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheTokens: number;
  totalTokens: number;
  costUsd: number;
  costEur: number;
}

export interface UsageReport {
  days: UsageDay[];
  months: UsageDay[]; // monthly aggregates (same shape; date = "YYYY-MM")
  blocks: UsageBlock[]; // last 24h, 5h buckets
  models: UsageModel[]; // per-model totals (from --breakdown)
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

// Per-conversation usage from `ccusage session`.
export interface UsageSession {
  sessionId: string;
  models: string[];
  inputTokens: number;
  outputTokens: number;
  cacheTokens: number;
  totalTokens: number;
  costUsd: number;
  costEur: number;
  lastActivity: string | null;
}

export interface CcusageModelBreakdown {
  modelName?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
  cost?: number;
  totalCost?: number;
}

export interface CcusageDaily {
  period?: string;
  month?: string; // monthly report uses `month` instead of `period`
  inputTokens?: number;
  outputTokens?: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
  totalTokens?: number;
  totalCost?: number;
  modelBreakdowns?: CcusageModelBreakdown[];
}

export interface CcusageBlock {
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

export interface CcusageSession {
  sessionId?: string;
  models?: string[];
  modelsUsed?: string[];
  inputTokens?: number;
  outputTokens?: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
  totalTokens?: number;
  totalCost?: number;
  costUSD?: number;
  lastActivity?: string;
}

const TTL_MS = 30_000;
let cache: { at: number; report: UsageReport } | null = null;
let sessionCache: { at: number; sessions: UsageSession[] } | null = null;

export function eurRate(): number {
  const r = Number(process.env.EUR_PER_USD);
  return Number.isFinite(r) && r > 0 ? r : 0.92;
}

export function empty(): UsageReport {
  return {
    days: [],
    months: [],
    blocks: [],
    models: [],
    totals: { inputTokens: 0, outputTokens: 0, cacheTokens: 0, totalTokens: 0, costUsd: 0, costEur: 0 },
    available: false,
  };
}

// ── Pure parsers (no exec, no cache) so the mapping is unit-testable ──────────

export function mapDailyRows(rows: CcusageDaily[], rate: number): UsageDay[] {
  return rows.map((d) => {
    const cacheTokens = (d.cacheCreationTokens ?? 0) + (d.cacheReadTokens ?? 0);
    const costUsd = d.totalCost ?? 0;
    return {
      date: d.period ?? d.month ?? "",
      inputTokens: d.inputTokens ?? 0,
      outputTokens: d.outputTokens ?? 0,
      cacheTokens,
      totalTokens: d.totalTokens ?? 0,
      costUsd,
      costEur: costUsd * rate,
    };
  });
}

// Aggregate the per-day model breakdowns into per-model totals, sorted by cost.
export function mapModelBreakdown(daily: CcusageDaily[], rate: number): UsageModel[] {
  const byModel = new Map<string, UsageModel>();
  for (const d of daily) {
    for (const b of d.modelBreakdowns ?? []) {
      const model = b.modelName ?? b.model ?? "unknown";
      const m =
        byModel.get(model) ??
        ({
          model,
          inputTokens: 0,
          outputTokens: 0,
          cacheTokens: 0,
          totalTokens: 0,
          costUsd: 0,
          costEur: 0,
        } satisfies UsageModel);
      m.inputTokens += b.inputTokens ?? 0;
      m.outputTokens += b.outputTokens ?? 0;
      m.cacheTokens += (b.cacheCreationTokens ?? 0) + (b.cacheReadTokens ?? 0);
      m.costUsd += b.cost ?? b.totalCost ?? 0;
      m.totalTokens = m.inputTokens + m.outputTokens + m.cacheTokens;
      m.costEur = m.costUsd * rate;
      byModel.set(model, m);
    }
  }
  return [...byModel.values()].sort((a, b) => b.costUsd - a.costUsd);
}

// Keep only non-gap blocks whose end falls within the 24h before `now`.
export function mapBlockRows(rows: CcusageBlock[], rate: number, now: number): UsageBlock[] {
  const since = now - 24 * 60 * 60 * 1000;
  return rows
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

// Per-session rows from `ccusage session` (field names vary by version → defensive).
export function mapSessionRows(rows: CcusageSession[], rate: number): UsageSession[] {
  return rows.map((r) => {
    const cacheTokens = (r.cacheCreationTokens ?? 0) + (r.cacheReadTokens ?? 0);
    const costUsd = r.totalCost ?? r.costUSD ?? 0;
    return {
      sessionId: r.sessionId ?? "",
      models: r.models ?? r.modelsUsed ?? [],
      inputTokens: r.inputTokens ?? 0,
      outputTokens: r.outputTokens ?? 0,
      cacheTokens,
      totalTokens: r.totalTokens ?? 0,
      costUsd,
      costEur: costUsd * rate,
      lastActivity: r.lastActivity ?? null,
    };
  });
}

// Assemble the full report from already-parsed ccusage rows. `blocks === null`
// means the blocks command was unavailable (best-effort) → empty blocks list.
export function buildReport(
  daily: CcusageDaily[],
  blocks: CcusageBlock[] | null,
  rate: number,
  now: number,
  monthly: CcusageDaily[] = [],
): UsageReport {
  const days = mapDailyRows(daily, rate);
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
  return {
    days,
    months: mapDailyRows(monthly, rate),
    blocks: blocks ? mapBlockRows(blocks, rate, now) : [],
    models: mapModelBreakdown(daily, rate),
    totals,
    available: true,
  };
}

export async function getUsage(): Promise<UsageReport> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.report;

  const rate = eurRate();
  const bin = path.join(process.cwd(), "node_modules", ".bin", "ccusage");
  const run = (cmd: string, ...args: string[]) =>
    execFileAsync(bin, [cmd, "--json", ...args], { timeout: 20_000, maxBuffer: 16 * 1024 * 1024 });

  try {
    // Daily (multi-day chart, with per-model breakdown) + blocks (last-24h view) +
    // monthly in parallel. Blocks/monthly are best-effort — a failure there still
    // yields the daily report.
    const [dailyRes, blocksRes, monthlyRes] = await Promise.allSettled([
      run("daily", "--breakdown"),
      run("blocks"),
      run("monthly"),
    ]);

    if (dailyRes.status !== "fulfilled") throw new Error("ccusage daily failed");

    const daily = (JSON.parse(dailyRes.value.stdout) as { daily?: CcusageDaily[] }).daily ?? [];
    const blocks =
      blocksRes.status === "fulfilled"
        ? (JSON.parse(blocksRes.value.stdout) as { blocks?: CcusageBlock[] }).blocks ?? []
        : null;
    const monthly =
      monthlyRes.status === "fulfilled"
        ? (JSON.parse(monthlyRes.value.stdout) as { monthly?: CcusageDaily[] }).monthly ?? []
        : [];

    const report = buildReport(daily, blocks, rate, Date.now(), monthly);
    cache = { at: Date.now(), report };
    return report;
  } catch {
    // ccusage missing / offline / no Claude data — degrade gracefully.
    const report = empty();
    cache = { at: Date.now(), report };
    return report;
  }
}

export interface SessionUsageReport {
  sessions: UsageSession[];
  available: boolean;
}

// Per-session cost/tokens/models from ccusage. Cached + degrades gracefully.
export async function getSessionUsage(): Promise<SessionUsageReport> {
  if (sessionCache && Date.now() - sessionCache.at < TTL_MS) {
    return { sessions: sessionCache.sessions, available: true };
  }
  const rate = eurRate();
  const bin = path.join(process.cwd(), "node_modules", ".bin", "ccusage");
  try {
    const { stdout } = await execFileAsync(bin, ["session", "--json"], {
      timeout: 20_000,
      maxBuffer: 16 * 1024 * 1024,
    });
    const parsed = JSON.parse(stdout) as { sessions?: CcusageSession[] };
    const sessions = mapSessionRows(parsed.sessions ?? [], rate);
    sessionCache = { at: Date.now(), sessions };
    return { sessions, available: true };
  } catch {
    return { sessions: [], available: false };
  }
}
