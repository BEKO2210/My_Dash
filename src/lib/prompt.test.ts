import { afterEach, describe, expect, it } from "vitest";
import { estimateTokens, preparePrompt, redactSecrets, redactValue } from "@/lib/prompt";

const ENV = { ...process.env };
afterEach(() => {
  process.env = { ...ENV };
});

describe("estimateTokens", () => {
  it("estimates ~4 chars per token", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("abcde")).toBe(2);
  });
});

describe("redactSecrets", () => {
  it("redacts common token shapes", () => {
    expect(redactSecrets("use ghp_abcdefghijklmnopqrstuvwxyz0123 here")).toBe("use [REDACTED] here");
    expect(redactSecrets("AKIAIOSFODNN7EXAMPLE")).toBe("[REDACTED]");
    expect(redactSecrets("token sk-ant-api03-abcdefghijklmnop1234")).toContain("[REDACTED]");
  });

  it("redacts only the value in key=value pairs", () => {
    expect(redactSecrets("api_key=supersecretvalue")).toBe("api_key=[REDACTED]");
    expect(redactSecrets("password: hunter2")).toBe("password: [REDACTED]");
  });

  it("leaves ordinary text untouched", () => {
    expect(redactSecrets("a normal prompt about refactoring code")).toBe(
      "a normal prompt about refactoring code",
    );
  });

  it("can be disabled with MC_REDACT=0", () => {
    process.env.MC_REDACT = "0";
    expect(redactSecrets("ghp_abcdefghijklmnopqrstuvwxyz0123")).toBe(
      "ghp_abcdefghijklmnopqrstuvwxyz0123",
    );
  });
});

describe("redactValue", () => {
  const token = "ghp_abcdefghijklmnopqrstuvwxyz0123";

  it("redacts string values nested in objects and arrays, preserving shape", () => {
    const out = redactValue({
      command: `echo ${token}`,
      args: ["safe", `--secret=${token}`],
      nested: { note: "ordinary", count: 3 },
    }) as Record<string, unknown>;
    expect(JSON.stringify(out)).not.toContain(token);
    expect(JSON.stringify(out)).toContain("[REDACTED]");
    // shape + non-string primitives are preserved
    expect(Array.isArray(out.args)).toBe(true);
    expect((out.nested as Record<string, unknown>).count).toBe(3);
    expect((out.nested as Record<string, unknown>).note).toBe("ordinary");
  });

  it("passes through non-string primitives unchanged", () => {
    expect(redactValue(42)).toBe(42);
    expect(redactValue(true)).toBe(true);
    expect(redactValue(null)).toBe(null);
  });

  it("honours MC_REDACT=0", () => {
    process.env.MC_REDACT = "0";
    expect(redactValue({ command: token })).toEqual({ command: token });
  });
});

describe("preparePrompt", () => {
  it("returns the redacted full text, a capped copy and a token estimate", () => {
    const p = preparePrompt("x".repeat(20), 8);
    expect(p.redacted.length).toBe(20);
    expect(p.capped.length).toBe(8);
    expect(p.tokenEstimate).toBe(5); // 20 / 4
  });

  it("redacts before capping", () => {
    expect(preparePrompt("ghp_abcdefghijklmnopqrstuvwxyz0123").capped).toBe("[REDACTED]");
  });
});
