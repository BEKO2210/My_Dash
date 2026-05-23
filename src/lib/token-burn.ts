import type Database from "better-sqlite3";

// "Where do tokens burn?" — we don't store per-tool token counts, but each tool
// call's I/O is persisted (tool_io). The size of that I/O (chars / 4) is a solid
// proxy for the context a tool pushes through the model. Aggregated per tool and
// expressed as a share of the total. Estimate, clearly labelled as such in the UI.

export interface ToolTokenBurn {
  tool: string;
  calls: number;
  tokens: number; // estimated from I/O size
  share: number; // 0..1 of total estimated tokens
}

export function toolTokenBurn(db: Database.Database, limit = 8): ToolTokenBurn[] {
  const rows = db
    .prepare(
      `SELECT tc.tool_name AS tool,
              COUNT(*) AS calls,
              SUM(COALESCE(LENGTH(io.input_json), 0) + COALESCE(LENGTH(io.output_json), 0)) AS chars
       FROM tool_calls tc
       LEFT JOIN tool_io io ON io.tool_call_id = tc.id
       GROUP BY tc.tool_name`,
    )
    .all() as { tool: string; calls: number; chars: number | null }[];

  const withTokens = rows.map((r) => ({
    tool: r.tool,
    calls: r.calls,
    tokens: Math.ceil((r.chars ?? 0) / 4),
  }));
  const total = withTokens.reduce((a, r) => a + r.tokens, 0) || 1;

  return withTokens
    .sort((a, b) => b.tokens - a.tokens || a.tool.localeCompare(b.tool))
    .slice(0, limit)
    .map((r) => ({ ...r, share: r.tokens / total }));
}
