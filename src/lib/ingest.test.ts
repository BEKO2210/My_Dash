import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { EventRow, HookPayload, SessionRow, ToolCallRow, ToolIoRow } from "@/lib/types";

// Exercise the real ingest write path against a throwaway SQLite database. We point
// the db module at a temp dir via MC_DATA_DIR *before* importing it (dynamic import),
// so the real schema + prepared statements are used — just on a disposable file.
let ingest: (typeof import("@/lib/ingest"))["ingest"];
let db: (typeof import("@/lib/db"))["db"];
let updateSessionUsage: (typeof import("@/lib/transcript-sync"))["updateSessionUsage"];
let dataDir: string;

beforeAll(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), "mc-ingest-test-"));
  process.env.MC_DATA_DIR = dataDir;
  ({ ingest } = await import("@/lib/ingest"));
  ({ db } = await import("@/lib/db"));
  ({ updateSessionUsage } = await import("@/lib/transcript-sync"));
});

afterAll(() => {
  rmSync(dataDir, { recursive: true, force: true });
});

beforeEach(() => {
  db.exec("DELETE FROM events; DELETE FROM tool_calls; DELETE FROM sessions;");
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

  it("does not create a tool_call for a PostToolUse without a tool_name", () => {
    send("PostToolUse", { session_id: "s1" });
    expect(toolCalls("s1")).toHaveLength(0);
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
