// Prompt processing for ingest: a rough token estimate and secret redaction, so
// nothing sensitive is persisted (payload, title, summary, prompts table all use
// the redacted text). Redaction is on by default; set MC_REDACT=0 to disable.

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4); // ~4 chars/token heuristic
}

// Standalone token shapes — the whole match is replaced.
const TOKEN_PATTERNS: RegExp[] = [
  /\bsk-ant-[A-Za-z0-9_-]{16,}\b/g, // Anthropic
  /\bsk-[A-Za-z0-9_-]{16,}\b/g, // OpenAI-style
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, // GitHub tokens
  /\bAKIA[0-9A-Z]{16}\b/g, // AWS access key id
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g, // Slack
  /\bey[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, // JWT
];

// key = value / key: value where the key looks secret — only the value is dropped.
const KV_PATTERN =
  /\b((?:api[_-]?key|secret|token|password|passwd|access[_-]?key)\b\s*[:=]\s*)(["']?[^\s"']+["']?)/gi;

export function redactSecrets(text: string): string {
  if (process.env.MC_REDACT === "0") return text;
  let out = text;
  for (const re of TOKEN_PATTERNS) out = out.replace(re, "[REDACTED]");
  out = out.replace(KV_PATTERN, (_m, key: string) => `${key}[REDACTED]`);
  return out;
}

export interface PreparedPrompt {
  redacted: string; // full, redacted (for payload_json/title/summary)
  capped: string; // redacted + length-capped (for the prompts table)
  tokenEstimate: number; // estimated from the original prompt
}

export function preparePrompt(raw: string, cap = 8000): PreparedPrompt {
  const redacted = redactSecrets(raw);
  return {
    redacted,
    capped: redacted.length > cap ? redacted.slice(0, cap) : redacted,
    tokenEstimate: estimateTokens(raw),
  };
}
