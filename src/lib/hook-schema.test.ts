import { describe, expect, it } from "vitest";
import { parseHookPayload } from "@/lib/hook-schema";

describe("parseHookPayload", () => {
  it("accepts a full, well-typed payload", () => {
    const input = {
      session_id: "abc",
      cwd: "/home/user/proj",
      hook_event_name: "PostToolUse",
      tool_name: "Read",
      tool_input: { file_path: "/x.ts" },
      tool_response: { ok: true },
      source: "startup",
    };
    const r = parseHookPayload(input);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.payload).toMatchObject(input);
  });

  it("accepts an empty object (all fields optional)", () => {
    expect(parseHookPayload({}).ok).toBe(true);
  });

  it("passes unknown fields through untouched", () => {
    const r = parseHookPayload({ session_id: "abc", custom_field: 42, nested: { a: 1 } });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.payload.custom_field).toBe(42);
      expect(r.payload.nested).toEqual({ a: 1 });
    }
  });

  it("accepts arbitrary tool_response shapes", () => {
    expect(parseHookPayload({ tool_response: "a string" }).ok).toBe(true);
    expect(parseHookPayload({ tool_response: [1, 2, 3] }).ok).toBe(true);
    expect(parseHookPayload({ tool_response: null }).ok).toBe(true);
  });

  it("rejects a non-string session_id", () => {
    const r = parseHookPayload({ session_id: 123 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("session_id");
  });

  it("rejects a wrong-typed known field", () => {
    expect(parseHookPayload({ tool_name: 5 }).ok).toBe(false);
    expect(parseHookPayload({ prompt: { not: "a string" } }).ok).toBe(false);
  });

  it("rejects a non-object tool_input", () => {
    expect(parseHookPayload({ tool_input: "nope" }).ok).toBe(false);
  });

  it("rejects a non-object root", () => {
    expect(parseHookPayload("not an object").ok).toBe(false);
    expect(parseHookPayload(null).ok).toBe(false);
    expect(parseHookPayload(42).ok).toBe(false);
  });
});
