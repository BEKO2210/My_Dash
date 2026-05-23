import type Database from "better-sqlite3";

// Most-used tools over an optional time window, with failures, source and average
// duration. Horizontal-bar ranking data (precise comparison beats a treemap here).
export interface ToolStat {
  tool: string;
  count: number;
  failures: number;
  source: string | null; // "mcp" | "builtin"
  mcpServer: string | null;
  avgDurationMs: number | null;
}

export function toolFrequency(
  db: Database.Database,
  limit = 12,
  sinceIso: string | null = null,
): ToolStat[] {
  const cond = sinceIso ? "WHERE created_at >= ?" : "";
  const params = sinceIso ? [sinceIso, limit] : [limit];
  return db
    .prepare(
      `SELECT tool_name AS tool,
              COUNT(*) AS count,
              SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) AS failures,
              MAX(source) AS source,
              MAX(mcp_server) AS mcpServer,
              CAST(AVG(duration_ms) AS INTEGER) AS avgDurationMs
       FROM tool_calls
       ${cond}
       GROUP BY tool_name
       ORDER BY count DESC, tool ASC
       LIMIT ?`,
    )
    .all(...params) as ToolStat[];
}
