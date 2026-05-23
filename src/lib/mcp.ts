// MCP tools are named `mcp__<server>__<tool>` (e.g. mcp__github__create_pull_request).
// Server ids can contain dashes; tool names can contain underscores — so split on
// the FIRST `__` after the prefix: everything before is the server, the rest is the
// tool.

export interface McpToolInfo {
  isMcp: boolean;
  server: string | null;
  tool: string | null;
}

const PREFIX = "mcp__";

export function parseMcpTool(name: string | null | undefined): McpToolInfo {
  if (!name || !name.startsWith(PREFIX)) return { isMcp: false, server: null, tool: null };
  const rest = name.slice(PREFIX.length);
  if (!rest) return { isMcp: false, server: null, tool: null };
  const idx = rest.indexOf("__");
  if (idx <= 0) return { isMcp: true, server: rest, tool: null };
  return { isMcp: true, server: rest.slice(0, idx), tool: rest.slice(idx + 2) };
}
