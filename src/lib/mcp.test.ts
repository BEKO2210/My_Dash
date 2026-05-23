import { describe, expect, it } from "vitest";
import { parseMcpTool } from "@/lib/mcp";

describe("parseMcpTool", () => {
  it("splits server and tool on the first separator", () => {
    expect(parseMcpTool("mcp__github__create_pull_request")).toEqual({
      isMcp: true,
      server: "github",
      tool: "create_pull_request",
    });
  });

  it("keeps dashes in the server and underscores in the tool", () => {
    expect(parseMcpTool("mcp__213bc049-7a__web_fetch_url")).toEqual({
      isMcp: true,
      server: "213bc049-7a",
      tool: "web_fetch_url",
    });
  });

  it("treats a built-in tool as non-MCP", () => {
    expect(parseMcpTool("Read")).toEqual({ isMcp: false, server: null, tool: null });
    expect(parseMcpTool("Bash")).toEqual({ isMcp: false, server: null, tool: null });
  });

  it("handles null/empty and the bare prefix", () => {
    expect(parseMcpTool(null)).toEqual({ isMcp: false, server: null, tool: null });
    expect(parseMcpTool("")).toEqual({ isMcp: false, server: null, tool: null });
    expect(parseMcpTool("mcp__")).toEqual({ isMcp: false, server: null, tool: null });
  });

  it("tolerates an MCP name without a tool segment", () => {
    expect(parseMcpTool("mcp__serveronly")).toEqual({
      isMcp: true,
      server: "serveronly",
      tool: null,
    });
  });
});
