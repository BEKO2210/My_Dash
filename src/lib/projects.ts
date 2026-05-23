import type Database from "better-sqlite3";

// Per-project rollup over the sessions table (cost, tokens, session count).
export interface ProjectUsage {
  project: string;
  sessions: number;
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
    .all(limit) as Omit<ProjectUsage, "totalTokens">[];
  return rows.map((r) => ({
    ...r,
    totalTokens: r.tokenInput + r.tokenOutput + r.tokenCache,
  }));
}
