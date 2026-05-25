import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { SessionRow } from "@/lib/types";

// transcript-sync writes onto the singleton db, so point it at a temp file first.
let db: (typeof import("@/lib/db"))["db"];
let updateSessionUsage: (typeof import("@/lib/transcript-sync"))["updateSessionUsage"];
let scheduleTranscriptUpdate: (typeof import("@/lib/transcript-sync"))["scheduleTranscriptUpdate"];
let dataDir: string;

beforeAll(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), "mc-transcriptsync-test-"));
  process.env.MC_DATA_DIR = dataDir;
  ({ db } = await import("@/lib/db"));
  ({ updateSessionUsage, scheduleTranscriptUpdate } = await import("@/lib/transcript-sync"));
});

afterAll(() => {
  rmSync(dataDir, { recursive: true, force: true });
  delete process.env.MC_DATA_DIR;
});

const usage = (id: string) =>
  db
    .prepare("SELECT token_input, token_output, token_cache, cost_usd FROM sessions WHERE id = ?")
    .get(id) as Pick<SessionRow, "token_input" | "token_output" | "token_cache" | "cost_usd">;

describe("updateSessionUsage", () => {
  it("writes transcript-derived tokens + an estimated cost onto the session", async () => {
    db.prepare("INSERT INTO sessions (id, status) VALUES ('t', 'active')").run();
    const file = path.join(dataDir, "t.jsonl");
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
    await updateSessionUsage("t", file);
    const s = usage("t");
    expect(s.token_input).toBe(500);
    expect(s.token_output).toBe(120);
    expect(s.token_cache).toBe(300); // 100 + 200
    expect(s.cost_usd).toBeGreaterThan(0);
  });

  it("no-ops when the transcript has no assistant usage (no turns)", async () => {
    db.prepare("INSERT INTO sessions (id, status, token_input) VALUES ('e', 'active', 0)").run();
    const file = path.join(dataDir, "e.jsonl");
    writeFileSync(file, JSON.stringify({ message: { role: "user", content: "hi" } }));
    await updateSessionUsage("e", file);
    expect(usage("e").token_input).toBe(0);
  });

  it("degrades silently for a missing transcript file", async () => {
    db.prepare("INSERT INTO sessions (id, status, token_input) VALUES ('m', 'active', 0)").run();
    await updateSessionUsage("m", "/no/such/transcript.jsonl");
    expect(usage("m").token_input).toBe(0);
  });
});

describe("scheduleTranscriptUpdate", () => {
  it("is fire-and-forget and never throws", () => {
    expect(() => scheduleTranscriptUpdate("m", "/no/such/transcript.jsonl", true)).not.toThrow();
  });
});
