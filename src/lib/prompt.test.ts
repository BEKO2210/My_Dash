import { afterEach, describe, expect, it } from "vitest";
import { estimateTokens, preparePrompt, redactSecrets } from "@/lib/prompt";

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
