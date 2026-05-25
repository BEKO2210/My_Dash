import type Database from "better-sqlite3";
import type { UsageSession } from "./ccusage";
import { reconcileSessions } from "./reconcile";

// Per-project rollup over sessions (cost, tokens, session count) plus tool calls.
export interface ProjectUsage {
  project: string;
  sessions: number;
  tools: number;
  costUsd: number;
  tokenInput: number;
  tokenOutput: number;
  tokenCache: number;
  totalTokens: number;
}

export function projectUsage(db: Database.Database, limit = 100): ProjectUsage[] {
  const rows = db
    .prepare(
      `SELECT COALESCE(NULLIF(project_name, ''), '(unknown)') AS project,
              COUNT(*)            AS sessions,
              SUM(cost_usd)       AS costUsd,
              SUM(token_input)    AS tokenInput,
              SUM(token_output)   AS tokenOutput,
              SUM(token_cache)    AS tokenCache
       FROM sessions
       GROUP BY project
       ORDER BY costUsd DESC, sessions DESC
       LIMIT ?`,
    )
    .all(limit) as Omit<ProjectUsage, "totalTokens" | "tools">[];

  // Tool calls per project (joined via session), merged in.
  const toolMap = new Map(
    (
      db
        .prepare(
          `SELECT COALESCE(NULLIF(s.project_name, ''), '(unknown)') AS project, COUNT(*) AS tools
           FROM tool_calls tc JOIN sessions s ON s.id = tc.session_id
           GROUP BY project`,
        )
        .all() as { project: string; tools: number }[]
    ).map((r) => [r.project, r.tools] as const),
  );

  return rows.map((r) => ({
    ...r,
    tools: toolMap.get(r.project) ?? 0,
    totalTokens: r.tokenInput + r.tokenOutput + r.tokenCache,
  }));
}

// Per-project cost reconciled to ccusage (ccusage > otlp > transcript, per session),
// so the leaderboard shows the authoritative figure instead of the raw transcript
// estimate (which diverges several-fold). A session with no ccusage match keeps its
// transcript estimate, so this degrades gracefully when ccusage is unavailable.
// Returns project → reconciled costUsd.
export function reconciledProjectCostUsd(
  db: Database.Database,
  ccusage: UsageSession[],
): Map<string, number> {
  const sessions = db
    .prepare(
      `SELECT id, COALESCE(NULLIF(project_name, ''), '(unknown)') AS project, cost_usd FROM sessions`,
    )
    .all() as { id: string; project: string; cost_usd: number }[];

  const costById = new Map(
    reconcileSessions(
      sessions.map((s) => ({ id: s.id, cost_usd: s.cost_usd })),
      ccusage,
    ).map((r) => [r.sessionId, r.costUsd]),
  );

  const byProject = new Map<string, number>();
  for (const s of sessions) {
    const cost = costById.get(s.id) ?? s.cost_usd;
    byProject.set(s.project, (byProject.get(s.project) ?? 0) + cost);
  }
  return byProject;
}
