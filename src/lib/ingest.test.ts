import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type {
  EventRow,
  FileEditRow,
  HookPayload,
  PromptRow,
  SessionLinkRow,
  SessionRow,
  ToolCallRow,
  ToolIoRow,
} from "@/lib/types";

// Exercise the real ingest write path against a throwaway SQLite database. We point
// the db module at a temp dir via MC_DATA_DIR *before* importing it (dynamic import),
// so the real schema + prepared statements are used — just on a disposable file.
let ingest: (typeof import("@/lib/ingest"))["ingest"];
let db: (typeof import("@/lib/db"))["db"];
let updateSessionUsage: (typeof import("@/lib/transcript-sync"))["updateSessionUsage"];
let updateSessionGit: (typeof import("@/lib/git-sync"))["updateSessionGit"];
let dataDir: string;

beforeAll(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), "mc-ingest-test-"));
  process.env.MC_DATA_DIR = dataDir;
  ({ ingest } = await import("@/lib/ingest"));
  ({ db } = await import("@/lib/db"));
  ({ updateSessionUsage } = await import("@/lib/transcript-sync"));
  ({ updateSessionGit } = await import("@/lib/git-sync"));
});

afterAll(() => {
  rmSync(dataDir, { recursive: true, force: true });
});

beforeEach(() => {
  db.exec(
    "DELETE FROM events; DELETE FROM tool_calls; DELETE FROM tool_io; DELETE FROM session_links; DELETE FROM prompts; DELETE FROM file_edits; DELETE FROM activity_buckets; DELETE FROM sessions;",
  );
  // The Pre/Post duration pairing keeps starts in a process-global map; reset it
  // so each test is deterministic.
  (globalThis as unknown as { __mcPending?: Map<string, number> }).__mcPending?.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

const CWD = "/home/user/My_Dash";

function send(eventType: string, over: Partial<HookPayload> & { session_id: string }) {
  return ingest(eventType, { hook_event_name: eventType, cwd: CWD, ...over });
}

const session = (id: string) =>
  db.prepare("SELECT * FROM sessions WHERE id = ?").get(id) as SessionRow | undefined;
const events = (id: string) =>
  db.prepare("SELECT * FROM events WHERE session_id = ? ORDER BY id").all(id) as EventRow[];
const toolCalls = (id: string) =>
  db.prepare("SELECT * FROM tool_calls WHERE session_id = ? ORDER BY id").all(id) as ToolCallRow[];
const toolIo = (callId: number) =>
  db.prepare("SELECT * FROM tool_io WHERE tool_call_id = ?").get(callId) as ToolIoRow | undefined;
const links = (parentId: string) =>
  db.prepare("SELECT * FROM session_links WHERE parent_session_id = ?").all(parentId) as SessionLinkRow[];
const prompts = (id: string) =>
  db.prepare("SELECT * FROM prompts WHERE session_id = ? ORDER BY id").all(id) as PromptRow[];
const fileEdits = (id: string) =>
  db.prepare("SELECT * FROM file_edits WHERE session_id = ? ORDER BY id").all(id) as FileEditRow[];
const activity = () =>
  db.prepare("SELECT bucket, event_type, count FROM activity_buckets").all() as {
    bucket: string;
    event_type: string;
    count: number;
  }[];

describe("ingest — session creation", () => {
  it("creates an active session and derives project_name from cwd", () => {
    const { session: s } = send("SessionStart", { session_id: "s1", source: "startup" });
    expect(s.id).toBe("s1");
    expect(s.status).toBe("active");
    expect(s.project_name).toBe("My_Dash");
    expect(s.project_path).toBe(CWD);
    expect(s.source).toBe("startup");
  });

  it("inserts one event row per ingest with the right shape", () => {
    send("SessionStart", { session_id: "s1" });
    send("UserPromptSubmit", { session_id: "s1", prompt: "hello" });
    const rows = events("s1");
    expect(rows).toHaveLength(2);
    expect(rows.map((e) => e.event_type)).toEqual(["SessionStart", "UserPromptSubmit"]);
    // payload_json round-trips back to the original payload.
    expect(JSON.parse(rows[1].payload_json).session_id).toBe("s1");
  });

  it("ignores a non-existent session lookup gracefully", () => {
    expect(session("nope")).toBeUndefined();
  });
});

describe("ingest — status projection", () => {
  it("Stop marks the session waiting, NOT ended", () => {
    send("SessionStart", { session_id: "s1" });
    const { session: s } = send("Stop", { session_id: "s1" });
    expect(s.status).toBe("waiting");
    expect(s.ended_at).toBeNull();
  });

  it("Notification and SubagentStop also mean waiting", () => {
    send("SessionStart", { session_id: "s1" });
    expect(send("Notification", { session_id: "s1" }).session.status).toBe("waiting");
    expect(send("SubagentStop", { session_id: "s1" }).session.status).toBe("waiting");
  });

  it("a tool cycle keeps the session active", () => {
    send("Stop", { session_id: "s1" }); // waiting first
    const { session: s } = send("PreToolUse", { session_id: "s1", tool_name: "Read" });
    expect(s.status).toBe("active");
  });

  it("SessionEnd ends the session and stamps ended_at", () => {
    send("SessionStart", { session_id: "s1" });
    const { session: s } = send("SessionEnd", { session_id: "s1", reason: "exit" });
    expect(s.status).toBe("ended");
    expect(s.ended_at).not.toBeNull();
  });
});

describe("ingest — title", () => {
  it("sets the title from the first prompt only", () => {
    send("UserPromptSubmit", { session_id: "s1", prompt: "first prompt" });
    send("UserPromptSubmit", { session_id: "s1", prompt: "second prompt" });
    expect(session("s1")?.title).toBe("first prompt");
  });

  it("collapses whitespace and truncates a long prompt to 90 chars", () => {
    const long = "word ".repeat(40); // 200 chars, lots of spaces
    send("UserPromptSubmit", { session_id: "s1", prompt: long });
    const title = session("s1")!.title!;
    expect(title.length).toBe(90);
    expect(title.endsWith("…")).toBe(true);
    expect(title).not.toContain("  ");
  });
});

describe("ingest — tool calls", () => {
  it("records the tool, target and success on PostToolUse", () => {
    send("PreToolUse", { session_id: "s1", tool_name: "Read", tool_input: { file_path: "/a/b.ts" } });
    send("PostToolUse", {
      session_id: "s1",
      tool_name: "Read",
      tool_input: { file_path: "/a/b.ts" },
      tool_response: { ok: true },
    });
    const calls = toolCalls("s1");
    expect(calls).toHaveLength(1);
    expect(calls[0].tool_name).toBe("Read");
    expect(calls[0].target).toBe("/a/b.ts");
    expect(calls[0].success).toBe(1);
  });

  it("marks a failed tool response as unsuccessful", () => {
    send("PreToolUse", { session_id: "s1", tool_name: "Bash", tool_input: { command: "false" } });
    send("PostToolUse", {
      session_id: "s1",
      tool_name: "Bash",
      tool_input: { command: "false" },
      tool_response: { is_error: true },
    });
    expect(toolCalls("s1")[0].success).toBe(0);
  });

  it("stores tool input/output in tool_io for a successful call", () => {
    send("PreToolUse", { session_id: "s1", tool_name: "Read", tool_input: { file_path: "/a.ts" } });
    send("PostToolUse", {
      session_id: "s1",
      tool_name: "Read",
      tool_input: { file_path: "/a.ts" },
      tool_response: { content: "hi" },
    });
    const call = toolCalls("s1")[0];
    const io = toolIo(call.id);
    expect(io).toBeDefined();
    expect(JSON.parse(io!.input_json!)).toEqual({ file_path: "/a.ts" });
    expect(JSON.parse(io!.output_json!)).toEqual({ content: "hi" });
    expect(io!.is_error).toBe(0);
    expect(io!.error_text).toBeNull();
  });

  it("captures the error flag and message in tool_io for a failed call", () => {
    send("PreToolUse", { session_id: "s1", tool_name: "Bash", tool_input: { command: "x" } });
    send("PostToolUse", {
      session_id: "s1",
      tool_name: "Bash",
      tool_input: { command: "x" },
      tool_response: { is_error: true, error: "command not found" },
    });
    const io = toolIo(toolCalls("s1")[0].id)!;
    expect(io.is_error).toBe(1);
    expect(io.error_text).toBe("command not found");
  });

  it("pairs Pre/Post by elapsed wall-clock time for the duration", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-23T10:00:00Z"));
    send("PreToolUse", { session_id: "s1", tool_name: "Bash", tool_input: { command: "sleep 1" } });
    vi.advanceTimersByTime(1500);
    send("PostToolUse", {
      session_id: "s1",
      tool_name: "Bash",
      tool_input: { command: "sleep 1" },
      tool_response: {},
    });
    expect(toolCalls("s1")[0].duration_ms).toBe(1500);
  });

  it("tags an MCP tool call with source and server", () => {
    send("PostToolUse", {
      session_id: "s1",
      tool_name: "mcp__github__create_pull_request",
      tool_input: {},
      tool_response: { ok: true },
    });
    const call = toolCalls("s1")[0];
    expect(call.source).toBe("mcp");
    expect(call.mcp_server).toBe("github");
  });

  it("tags a built-in tool call as builtin with no server", () => {
    send("PostToolUse", {
      session_id: "s1",
      tool_name: "Read",
      tool_input: { file_path: "/a.ts" },
      tool_response: {},
    });
    const call = toolCalls("s1")[0];
    expect(call.source).toBe("builtin");
    expect(call.mcp_server).toBeNull();
  });

  it("records a subagent link for a Task tool call", () => {
    send("PostToolUse", {
      session_id: "s1",
      tool_name: "Task",
      tool_input: { subagent_type: "Explore", description: "find the bug" },
      tool_response: { ok: true },
    });
    const [link] = links("s1");
    expect(link).toBeDefined();
    expect(link.kind).toBe("subagent");
    expect(link.label).toBe("Explore");
    expect(link.tool_call_id).toBe(toolCalls("s1")[0].id);
    expect(link.child_session_id).toBeNull();
  });

  it("does not record a link for a non-Task tool", () => {
    send("PostToolUse", {
      session_id: "s1",
      tool_name: "Read",
      tool_input: { file_path: "/a.ts" },
      tool_response: {},
    });
    expect(links("s1")).toHaveLength(0);
  });

  it("records a file_edit for a successful Edit", () => {
    send("PostToolUse", {
      session_id: "s1",
      tool_name: "Edit",
      tool_input: { file_path: "/src/x.ts", old_string: "a", new_string: "a\nb\nc" },
      tool_response: { ok: true },
    });
    const [fe] = fileEdits("s1");
    expect(fe.path).toBe("/src/x.ts");
    expect(fe.added).toBe(3);
    expect(fe.removed).toBe(1);
    expect(fe.tool_call_id).toBe(toolCalls("s1")[0].id);
  });

  it("does not record a file_edit for a failed edit or a non-file tool", () => {
    send("PostToolUse", {
      session_id: "s1",
      tool_name: "Edit",
      tool_input: { file_path: "/src/x.ts", old_string: "a", new_string: "b" },
      tool_response: { is_error: true },
    });
    send("PostToolUse", {
      session_id: "s1",
      tool_name: "Bash",
      tool_input: { command: "ls" },
      tool_response: {},
    });
    expect(fileEdits("s1")).toHaveLength(0);
  });

  it("does not create a tool_call for a PostToolUse without a tool_name", () => {
    send("PostToolUse", { session_id: "s1" });
    expect(toolCalls("s1")).toHaveLength(0);
  });
});

describe("ingest — prompt redaction & storage", () => {
  it("redacts secrets everywhere and stores a prompt row with a token estimate", () => {
    const secret = "ghp_abcdefghijklmnopqrstuvwxyz0123";
    const { event } = send("UserPromptSubmit", {
      session_id: "s1",
      prompt: `deploy with ${secret} now`,
    });

    // Title, payload_json and the prompts row are all redacted.
    expect(session("s1")!.title).toContain("[REDACTED]");
    expect(session("s1")!.title).not.toContain(secret);
    expect(event.payload_json).toContain("[REDACTED]");
    expect(event.payload_json).not.toContain(secret);

    const rows = prompts("s1");
    expect(rows).toHaveLength(1);
    expect(rows[0].text).toContain("[REDACTED]");
    expect(rows[0].text).not.toContain(secret);
    expect(rows[0].event_id).toBe(event.id);
    expect(rows[0].token_estimate).toBeGreaterThan(0);
  });

  it("does not create a prompt row for non-prompt events", () => {
    send("SessionStart", { session_id: "s1" });
    expect(prompts("s1")).toHaveLength(0);
  });
});

describe("ingest — model", () => {
  it("captures the model from the payload when present", () => {
    const { event } = send("UserPromptSubmit", {
      session_id: "s1",
      prompt: "hi",
      model: "claude-opus-4-7",
    });
    expect(event.model).toBe("claude-opus-4-7");
  });

  it("leaves model null when the payload omits it", () => {
    const { event } = send("SessionStart", { session_id: "s1" });
    expect(event.model).toBeNull();
  });
});

describe("ingest — transcript usage sync", () => {
  it("writes transcript-derived tokens and an estimated cost onto the session", async () => {
    send("SessionStart", { session_id: "s1" });
    const file = path.join(dataDir, "transcript.jsonl");
    writeFileSync(
      file,
      JSON.stringify({
        message: {
          role: "assistant",
          model: "claude-opus-4-7",
          content: [{ type: "text", text: "x" }],
          usage: {
            input_tokens: 500,
            output_tokens: 120,
            cache_creation_input_tokens: 100,
            cache_read_input_tokens: 200,
          },
        },
      }),
    );

    await updateSessionUsage("s1", file);

    const s = session("s1")!;
    expect(s.token_input).toBe(500);
    expect(s.token_output).toBe(120);
    expect(s.token_cache).toBe(300); // 100 + 200
    expect(s.cost_usd).toBeCloseTo(0.018675, 9);
  });
});

describe("ingest — git context sync", () => {
  it("writes the git commit onto the session from its cwd", async () => {
    send("SessionStart", { session_id: "s1" });
    await updateSessionGit("s1", process.cwd());
    expect(session("s1")!.git_commit).toMatch(/^[0-9a-f]{7,}$/);
  });

  it("leaves git fields null for a non-git cwd", async () => {
    send("SessionStart", { session_id: "s1" });
    await updateSessionGit("s1", "/no/such/dir/xyz");
    expect(session("s1")!.git_commit).toBeNull();
    expect(session("s1")!.branch).toBeNull();
  });
});

describe("ingest — activity rollup", () => {
  it("rolls up event counts by hour bucket and type", () => {
    send("PreToolUse", { session_id: "s1", tool_name: "Read" });
    send("PreToolUse", { session_id: "s1", tool_name: "Read" });
    send("Stop", { session_id: "s1" });

    const rows = activity();
    expect(rows.find((r) => r.event_type === "PreToolUse")!.count).toBe(2);
    expect(rows.find((r) => r.event_type === "Stop")!.count).toBe(1);
    // bucket is an hour key derived from created_at.
    expect(rows[0].bucket).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}$/);
  });
});

describe("ingest — return value", () => {
  it("returns the inserted event paired with the current session", () => {
    const { event, session: s } = send("UserPromptSubmit", { session_id: "s1", prompt: "hi" });
    expect(event.id).toBeGreaterThan(0);
    expect(event.session_id).toBe("s1");
    expect(event.event_type).toBe("UserPromptSubmit");
    expect(s.id).toBe("s1");
    expect(s.title).toBe("hi");
  });
});
