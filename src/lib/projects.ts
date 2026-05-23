import type Database from "better-sqlite3";

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
