import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseTranscriptUsage, summarizeTranscript } from "@/lib/transcript";

const TRANSCRIPT = [
  JSON.stringify({ type: "user", message: { role: "user", content: "hello" } }),
  JSON.stringify({
    message: {
      role: "assistant",
      model: "claude-opus-4-7",
      content: [{ type: "text", text: "Hi there" }],
      usage: {
        input_tokens: 100,
        output_tokens: 50,
        cache_creation_input_tokens: 10,
        cache_read_input_tokens: 20,
      },
    },
  }),
  "{ not valid json",
  JSON.stringify({
    message: {
      role: "assistant",
      model: "claude-opus-4-7",
      content: [{ type: "text", text: "Done" }],
      usage: { input_tokens: 200, output_tokens: 80, cache_read_input_tokens: 30 },
    },
  }),
].join("\n");

describe("parseTranscriptUsage", () => {
  it("sums billable usage across assistant turns and skips user/malformed lines", () => {
    const s = parseTranscriptUsage(TRANSCRIPT);
    expect(s.inputTokens).toBe(300);
    expect(s.outputTokens).toBe(130);
    expect(s.cacheTokens).toBe(60); // 10 + 20 + 30
    expect(s.cacheCreationTokens).toBe(10);
    expect(s.cacheReadTokens).toBe(50); // 20 + 30
    expect(s.turns).toBe(2);
    expect(s.model).toBe("claude-opus-4-7");
    expect(s.lastAssistantText).toBe("Done");
  });

  it("returns zeros for an empty transcript", () => {
    expect(parseTranscriptUsage("")).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      cacheTokens: 0,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
      model: null,
      lastAssistantText: null,
      turns: 0,
    });
  });

  it("ignores assistant turns without usage but still captures text", () => {
    const line = JSON.stringify({
      message: { role: "assistant", content: [{ type: "text", text: "no usage" }] },
    });
    const s = parseTranscriptUsage(line);
    expect(s.turns).toBe(0);
    expect(s.lastAssistantText).toBe("no usage");
  });
});

describe("summarizeTranscript", () => {
  let dir: string;
  afterEach(() => dir && rmSync(dir, { recursive: true, force: true }));

  it("reads and summarizes a transcript file", async () => {
    dir = mkdtempSync(path.join(tmpdir(), "mc-transcript-"));
    const file = path.join(dir, "session.jsonl");
    writeFileSync(file, TRANSCRIPT);
    const s = await summarizeTranscript(file);
    expect(s?.inputTokens).toBe(300);
    expect(s?.turns).toBe(2);
  });

  it("returns null for a missing file", async () => {
    expect(await summarizeTranscript("/no/such/transcript.jsonl")).toBeNull();
  });
});
