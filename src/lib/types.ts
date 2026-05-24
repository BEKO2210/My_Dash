// Shared types for the whole app — the one place that defines the event vocabulary.

export const HOOK_EVENTS = [
  "SessionStart",
  "UserPromptSubmit",
  "PreToolUse",
  "PostToolUse",
  "Notification",
  "Stop",
  "SubagentStop",
  "PreCompact",
  "SessionEnd",
] as const;

export type HookEvent = (typeof HOOK_EVENTS)[number];

export type SessionStatus = "active" | "waiting" | "ended";

// Raw payload as sent by a Claude Code hook (superset — fields vary per event).
export interface HookPayload {
  session_id?: string;
  transcript_path?: string;
  cwd?: string;
  hook_event_name?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_response?: unknown;
  prompt?: string;
  message?: string;
  source?: string;
  reason?: string;
  trigger?: string;
  [key: string]: unknown;
}

export interface SessionRow {
  id: string;
  project_path: string | null;
  project_name: string | null;
  title: string | null;
  status: SessionStatus;
  source: string | null;
  first_seen: string;
  last_seen: string;
  ended_at: string | null;
  token_input: number;
  token_output: number;
  token_cache: number;
  cost_usd: number;
  branch: string | null;
  git_commit: string | null;
  transcript_path: string | null;
}

export interface EventRow {
  id: number;
  session_id: string;
  event_type: string;
  tool_name: string | null;
  model: string | null;
  summary: string | null;
  payload_json: string;
  created_at: string;
}

export interface ToolCallRow {
  id: number;
  session_id: string;
  tool_name: string;
  target: string | null;
  duration_ms: number | null;
  success: number | null;
  source: string | null; // "mcp" | "builtin"
  mcp_server: string | null;
  created_at: string;
}

// Raw I/O for a single tool call (1:1 with tool_calls.id) — powers the inspector.
export interface ToolIoRow {
  tool_call_id: number;
  input_json: string | null;
  output_json: string | null;
  is_error: number;
  error_text: string | null;
}

// An estimated file change from an Edit/Write/NotebookEdit tool call.
export interface FileEditRow {
  id: number;
  session_id: string;
  tool_call_id: number | null;
  path: string;
  added: number;
  removed: number;
  created_at: string;
}

// A stored user prompt (redacted + capped) with a token estimate.
export interface PromptRow {
  id: number;
  session_id: string;
  event_id: number | null;
  text: string | null;
  token_estimate: number;
  created_at: string;
}

// A parent/child relationship between sessions — currently a Task → subagent link.
export interface SessionLinkRow {
  id: number;
  parent_session_id: string;
  child_session_id: string | null;
  tool_call_id: number | null;
  kind: string;
  label: string | null;
  created_at: string;
}

// What the SSE stream pushes to the browser on every ingested event.
export interface StreamMessage {
  event: EventRow;
  session: SessionRow;
}
