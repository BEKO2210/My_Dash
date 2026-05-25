import { describe, expect, it } from "vitest";
import { buildGraphData, describeTarget, programName, type PromptRow } from "@/lib/graph";
import type { SessionRow, ToolCallRow } from "@/lib/types";

function mkSession(over: Partial<SessionRow> & { id: string }): SessionRow {
  return {
    id: over.id,
    project_path: "/home/user/proj",
    project_name: "proj",
    title: null,
    status: "active",
    source: null,
    first_seen: "2026-05-23 10:00:00",
    last_seen: "2026-05-23 10:00:00",
    ended_at: null,
    token_input: 0,
    token_output: 0,
    cost_usd: 0,
    ...over,
  };
}

function mkCall(over: Partial<ToolCallRow> & { session_id: string; tool_name: string }): ToolCallRow {
  return {
    id: 1,
    target: null,
    duration_ms: null,
    success: 1,
    source: null,
    mcp_server: null,
    created_at: "2026-05-23 10:00:00",
    ...over,
  };
}

describe("programName", () => {
  it("takes the first program of a simple command", () => {
    expect(programName("grep -r foo .")).toBe("grep");
  });

  it("skips leading VAR=val assignments", () => {
    expect(programName("FOO=bar node script.js")).toBe("node");
  });

  it("skips a cd prefix and groups the real program", () => {
    expect(programName("cd /x && node app.js")).toBe("node");
  });

  it("reduces an absolute path to its basename", () => {
    expect(programName("/usr/bin/python3 main.py")).toBe("python3");
  });

  it("uses the first sub-command of a pipe", () => {
    expect(programName("ls -la | grep foo")).toBe("ls");
  });

  it("falls back to cd when there is nothing else", () => {
    expect(programName("cd /some/dir")).toBe("cd");
  });
});

describe("describeTarget", () => {
  it("classifies an http(s) target by host", () => {
    const d = describeTarget("WebFetch", "https://example.com/a/b?q=1");
    expect(d).toMatchObject({ key: "u:example.com", label: "example.com", kind: "url" });
  });

  it("classifies an absolute path as a file with a 2-segment label", () => {
    const d = describeTarget("Read", "/home/user/My_Dash/src/lib/db.ts");
    expect(d.kind).toBe("file");
    expect(d.key).toBe("f:/home/user/My_Dash/src/lib/db.ts");
    expect(d.label).toBe("lib/db.ts");
  });

  it("treats a slash-bearing relative target without spaces as a file", () => {
    expect(describeTarget("Read", "src/lib/db.ts").kind).toBe("file");
  });

  it("classifies a Bash target as a command keyed by program", () => {
    const d = describeTarget("Bash", "npm run build");
    expect(d).toMatchObject({ key: "cmd:npm", label: "npm", kind: "command" });
  });

  it("treats a spaced non-path target from any tool as a command", () => {
    expect(describeTarget(null, "some free text").kind).toBe("command");
  });

  it("classifies a plain token as a pattern", () => {
    const d = describeTarget("Grep", "TODO");
    expect(d).toMatchObject({ key: "q:TODO", label: "TODO", kind: "pattern" });
  });

  it("truncates a long pattern label", () => {
    const d = describeTarget("Grep", "x".repeat(40));
    expect(d.kind).toBe("pattern");
    expect(d.label.length).toBe(24);
    expect(d.label.endsWith("…")).toBe(true);
  });
});

describe("buildGraphData", () => {
  const noPrompts = new Map<string, PromptRow[]>();

  it("prunes a session with no tools or prompts", () => {
    const data = buildGraphData([mkSession({ id: "s1" })], noPrompts, new Map());
    expect(data.nodes).toEqual([]);
    expect(data.links).toEqual([]);
  });

  it("builds session -> tool -> file and dedups a shared resource across sessions", () => {
    const sessions = [mkSession({ id: "A" }), mkSession({ id: "B" })];
    const calls = new Map<string, ToolCallRow[]>([
      ["A", [mkCall({ session_id: "A", tool_name: "Read", target: "/x.ts" })]],
      ["B", [mkCall({ session_id: "B", tool_name: "Read", target: "/x.ts" })]],
    ]);
    const { nodes, links } = buildGraphData(sessions, noPrompts, calls);

    const file = nodes.find((n) => n.id === "f:/x.ts");
    expect(file).toBeDefined();
    expect(file!.type).toBe("file");
    // Same file referenced from both sessions -> one shared node, val/calls bumped.
    expect(file!.val).toBe(2);
    expect(file!.meta?.calls).toBe(2);

    // Tool nodes are per-session; the file node is global.
    expect(nodes.filter((n) => n.type === "tool").map((n) => n.id).sort()).toEqual([
      "t:A:Read",
      "t:B:Read",
    ]);
    expect(links).toContainEqual({ source: "s:A", target: "t:A:Read" });
    expect(links).toContainEqual({ source: "t:A:Read", target: "f:/x.ts" });
    expect(links).toContainEqual({ source: "t:B:Read", target: "f:/x.ts" });
  });

  it("dedups repeated links and bumps the per-session tool node value", () => {
    const calls = new Map<string, ToolCallRow[]>([
      [
        "A",
        [
          mkCall({ session_id: "A", tool_name: "Read", target: "/x.ts" }),
          mkCall({ session_id: "A", tool_name: "Read", target: "/x.ts" }),
        ],
      ],
    ]);
    const { nodes, links } = buildGraphData([mkSession({ id: "A" })], noPrompts, calls);
    const tool = nodes.find((n) => n.id === "t:A:Read");
    expect(tool!.val).toBe(2); // two calls increment the node
    // ...but the identical links collapse to one each.
    expect(links.filter((l) => l.source === "s:A" && l.target === "t:A:Read")).toHaveLength(1);
    expect(links.filter((l) => l.source === "t:A:Read" && l.target === "f:/x.ts")).toHaveLength(1);
  });

  it("makes a Task target an agent prompt node, not a file", () => {
    const calls = new Map<string, ToolCallRow[]>([
      ["A", [mkCall({ session_id: "A", tool_name: "Task", target: "investigate the bug" })]],
    ]);
    const { nodes } = buildGraphData([mkSession({ id: "A" })], noPrompts, calls);
    const agent = nodes.find((n) => n.id === "pa:A:investigate the bug");
    expect(agent!.type).toBe("prompt");
    expect(agent!.meta?.role).toBe("agent");
  });

  it("creates a tool node with no resource when the call has no target", () => {
    const calls = new Map<string, ToolCallRow[]>([
      ["A", [mkCall({ session_id: "A", tool_name: "Bash", target: null })]],
    ]);
    const { nodes, links } = buildGraphData([mkSession({ id: "A" })], noPrompts, calls);
    expect(nodes.map((n) => n.type).sort()).toEqual(["session", "tool"]);
    expect(links).toEqual([{ source: "s:A", target: "t:A:Bash" }]);
  });

  it("derives prompt text from payload_json and links it to the session", () => {
    const prompts = new Map<string, PromptRow[]>([
      [
        "A",
        [{ summary: "Prompt: ignored", payload_json: '{"prompt":"do the thing"}', created_at: "t" }],
      ],
    ]);
    const { nodes, links } = buildGraphData([mkSession({ id: "A" })], prompts, new Map());
    const prompt = nodes.find((n) => n.type === "prompt");
    expect(prompt!.label).toBe("do the thing");
    expect(prompt!.meta?.role).toBe("user");
    expect(links).toContainEqual({ source: "s:A", target: "p:A:0" });
  });

  it("falls back to the summary (minus the 'Prompt:' prefix) when payload has no prompt", () => {
    const prompts = new Map<string, PromptRow[]>([
      ["A", [{ summary: "Prompt: hello there", payload_json: "{}", created_at: "t" }]],
    ]);
    const { nodes } = buildGraphData([mkSession({ id: "A" })], prompts, new Map());
    expect(nodes.find((n) => n.type === "prompt")!.label).toBe("hello there");
  });

  it("skips an empty prompt", () => {
    const prompts = new Map<string, PromptRow[]>([
      ["A", [{ summary: null, payload_json: "{}", created_at: "t" }]],
    ]);
    const { nodes } = buildGraphData([mkSession({ id: "A" })], prompts, new Map());
    expect(nodes).toEqual([]); // session has no links -> pruned
  });

  // Referential integrity: every link endpoint must resolve to a node in the output,
  // or react-force-graph crashes on `.x` of an undefined node (GATE-D #tool-graph).
  it("never emits a link whose endpoint is missing from nodes", () => {
    const sessions = [mkSession({ id: "A" }), mkSession({ id: "B" })];
    const prompts = new Map<string, PromptRow[]>([
      ["A", [{ summary: "Prompt: hi", payload_json: '{"prompt":"do it"}', created_at: "t" }]],
    ]);
    const calls = new Map<string, ToolCallRow[]>([
      [
        "A",
        [
          mkCall({ session_id: "A", tool_name: "Read", target: "/x.ts" }),
          mkCall({ session_id: "A", tool_name: "Task", target: "find the bug" }),
          mkCall({ session_id: "A", tool_name: "Bash", target: null }),
        ],
      ],
      ["B", [mkCall({ session_id: "B", tool_name: "WebFetch", target: "https://example.com/a" })]],
    ]);
    const { nodes, links } = buildGraphData(sessions, prompts, calls);
    const ids = new Set(nodes.map((n) => n.id));
    for (const l of links) {
      expect(ids.has(l.source), `dangling source ${l.source}`).toBe(true);
      expect(ids.has(l.target), `dangling target ${l.target}`).toBe(true);
    }
  });
});
