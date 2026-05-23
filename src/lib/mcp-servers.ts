import type Database from "better-sqlite3";

// Per-MCP-server rollup over tool_calls (source='mcp'): call volume, error rate,
// average latency, distinct tools and last use. Powers the MCP-server widget.
export interface McpServerUsage {
  server: string;
  calls: number;
  failures: number;
  errorRate: number; // 0..1
  tools: number;
  avgMs: number;
  last_at: string;
}

export function mcpServerUsage(db: Database.Database, limit = 50): McpServerUsage[] {
  const rows = db
    .prepare(
      `SELECT mcp_server AS server,
              COUNT(*) AS calls,
              SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) AS failures,
              COUNT(DISTINCT tool_name) AS tools,
              AVG(duration_ms) AS avgMs,
              MAX(created_at) AS last_at
       FROM tool_calls
       WHERE source = 'mcp' AND mcp_server IS NOT NULL AND mcp_server <> ''
       GROUP BY server
       ORDER BY calls DESC, server ASC
       LIMIT ?`,
    )
    .all(limit) as {
    server: string;
    calls: number;
    failures: number;
    tools: number;
    avgMs: number | null;
    last_at: string;
  }[];

  return rows.map((r) => ({
    server: r.server,
    calls: r.calls,
    failures: r.failures,
    errorRate: r.calls ? r.failures / r.calls : 0,
    tools: r.tools,
    avgMs: Math.round(r.avgMs ?? 0),
    last_at: r.last_at,
  }));
}
