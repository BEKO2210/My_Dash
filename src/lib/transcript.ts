import { open, readFile, stat } from "node:fs/promises";

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
      inputTokens += num(usage.input_tokens);
      outputTokens += num(usage.output_tokens);
      cacheCreationTokens += num(usage.cache_creation_input_tokens);
      cacheReadTokens += num(usage.cache_read_input_tokens);
      turns++;
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
