import { open, readFile, stat } from "node:fs/promises";
import { redactSecrets, redactValue } from "./prompt";

// Reads Claude Code's per-session JSONL transcript and rolls up the billable token
// usage (summed per assistant turn, like ccusage), the model, and the latest
// assistant text. Pure parsing is separated from file I/O so it can be unit-tested.

export interface TranscriptSummary {
  inputTokens: number;
  outputTokens: number;
  cacheTokens: number; // creation + read (for storage)
  cacheCreationTokens: number;
  cacheReadTokens: number;
  model: string | null;
  lastAssistantText: string | null;
  turns: number; // assistant turns that carried usage
}

function num(x: unknown): number {
  return typeof x === "number" && Number.isFinite(x) ? x : 0;
}

function textOf(content: unknown): string {
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    const parts: string[] = [];
    for (const block of content) {
      if (block && typeof block === "object") {
        const b = block as Record<string, unknown>;
        if (b.type === "text" && typeof b.text === "string") parts.push(b.text);
      }
    }
    return parts.join("\n").trim();
  }
  return "";
}

export function parseTranscriptUsage(text: string): TranscriptSummary {
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheCreationTokens = 0;
  let cacheReadTokens = 0;
  let turns = 0;
  let model: string | null = null;
  let lastAssistantText: string | null = null;
  // Claude Code transcripts repeat an assistant message (streaming, retries,
  // sub-agent sidechains) — its usage must be counted ONCE, like ccusage, or the
  // cost estimate inflates several-fold. Dedupe by the API message id (when present).
  const counted = new Set<string>();

  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    let obj: unknown;
    try {
      obj = JSON.parse(t);
    } catch {
      continue; // skip malformed / partial (tail) lines
    }
    const msg = (obj as Record<string, unknown>)?.message as Record<string, unknown> | undefined;
    if (!msg || msg.role !== "assistant") continue;

    const usage = msg.usage as Record<string, unknown> | undefined;
    if (usage && typeof usage === "object") {
      const id = typeof msg.id === "string" ? msg.id : null;
      if (!id || !counted.has(id)) {
        if (id) counted.add(id);
        inputTokens += num(usage.input_tokens);
        outputTokens += num(usage.output_tokens);
        cacheCreationTokens += num(usage.cache_creation_input_tokens);
        cacheReadTokens += num(usage.cache_read_input_tokens);
        turns++;
      }
    }
    if (typeof msg.model === "string") model = msg.model;
    const txt = textOf(msg.content);
    if (txt) lastAssistantText = txt;
  }

  return {
    inputTokens,
    outputTokens,
    cacheTokens: cacheCreationTokens + cacheReadTokens,
    cacheCreationTokens,
    cacheReadTokens,
    model,
    lastAssistantText,
    turns,
  };
}

// ── Read-only conversation rendering ────────────────────────────────────────
export interface TranscriptBlock {
  type: "text" | "thinking" | "tool_use" | "tool_result";
  text?: string; // text / thinking
  name?: string; // tool_use name
  input?: unknown; // tool_use input
  output?: unknown; // tool_result content
  isError?: boolean; // tool_result error flag
}

export interface TranscriptMessage {
  role: "user" | "assistant";
  blocks: TranscriptBlock[];
}

function blocksOf(content: unknown): TranscriptBlock[] {
  if (typeof content === "string") {
    const t = content.trim();
    return t ? [{ type: "text", text: t }] : [];
  }
  if (!Array.isArray(content)) return [];
  const out: TranscriptBlock[] = [];
  for (const raw of content) {
    if (!raw || typeof raw !== "object") continue;
    const b = raw as Record<string, unknown>;
    switch (b.type) {
      case "text":
        if (typeof b.text === "string" && b.text.trim()) out.push({ type: "text", text: b.text });
        break;
      case "thinking":
        if (typeof b.thinking === "string" && b.thinking.trim())
          out.push({ type: "thinking", text: b.thinking });
        break;
      case "tool_use":
        out.push({ type: "tool_use", name: typeof b.name === "string" ? b.name : "tool", input: b.input });
        break;
      case "tool_result":
        out.push({ type: "tool_result", output: b.content, isError: b.is_error === true });
        break;
    }
  }
  return out;
}

// Parse the JSONL transcript into an ordered, render-ready message list. Keeps
// only the last `maxMessages` (transcripts can be long); drops empty messages.
export function parseTranscriptMessages(text: string, maxMessages = 400): TranscriptMessage[] {
  const out: TranscriptMessage[] = [];
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    let obj: unknown;
    try {
      obj = JSON.parse(t);
    } catch {
      continue;
    }
    const msg = (obj as Record<string, unknown>)?.message as Record<string, unknown> | undefined;
    if (!msg || (msg.role !== "user" && msg.role !== "assistant")) continue;
    const blocks = blocksOf(msg.content);
    if (blocks.length === 0) continue;
    out.push({ role: msg.role, blocks });
  }
  return out.length > maxMessages ? out.slice(out.length - maxMessages) : out;
}

// Redact secrets from a parsed transcript before it leaves the server: text and
// thinking blocks via redactSecrets, and tool_use input + tool_result output
// recursively (they can carry tokens just like a prompt). Returns new objects;
// the inputs are not mutated.
export function redactTranscriptMessages(messages: TranscriptMessage[]): TranscriptMessage[] {
  return messages.map((m) => ({
    role: m.role,
    blocks: m.blocks.map((b) => {
      const nb: TranscriptBlock = { ...b };
      if (nb.text != null) nb.text = redactSecrets(nb.text);
      if (nb.input !== undefined) nb.input = redactValue(nb.input);
      if (nb.output !== undefined) nb.output = redactValue(nb.output);
      return nb;
    }),
  }));
}

const DEFAULT_MAX_BYTES = 8 * 1024 * 1024;

// Read the transcript, capping at maxBytes by reading only the tail of very large
// files (a cut first line just fails to parse and is skipped).
export async function readTranscriptText(path: string, maxBytes = DEFAULT_MAX_BYTES): Promise<string> {
  const st = await stat(path);
  if (st.size <= maxBytes) return readFile(path, "utf8");

  const fh = await open(path, "r");
  try {
    const buf = Buffer.alloc(maxBytes);
    await fh.read(buf, 0, maxBytes, st.size - maxBytes);
    return buf.toString("utf8");
  } finally {
    await fh.close();
  }
}

export async function summarizeTranscript(
  path: string,
  maxBytes?: number,
): Promise<TranscriptSummary | null> {
  try {
    return parseTranscriptUsage(await readTranscriptText(path, maxBytes));
  } catch {
    return null; // missing/unreadable transcript — degrade silently
  }
}
