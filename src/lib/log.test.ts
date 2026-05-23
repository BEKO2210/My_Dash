import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { formatRecord, log, normalizeContext } from "@/lib/log";

const ENV = { ...process.env };
afterEach(() => {
  vi.restoreAllMocks();
  process.env = { ...ENV };
});

describe("normalizeContext", () => {
  it("returns undefined for null/undefined", () => {
    expect(normalizeContext(null)).toBeUndefined();
    expect(normalizeContext(undefined)).toBeUndefined();
  });

  it("extracts message and stack from an Error", () => {
    const n = normalizeContext(new Error("boom"));
    expect(n).toMatchObject({ error: "boom" });
    expect(typeof n!.stack).toBe("string");
  });

  it("passes a plain object through and wraps primitives", () => {
    expect(normalizeContext({ a: 1 })).toEqual({ a: 1 });
    expect(normalizeContext("x")).toEqual({ detail: "x" });
  });
});

describe("formatRecord", () => {
  it("builds a record with time, level, msg and merged context", () => {
    const r = formatRecord("error", "failed", { code: 42 }, "2026-01-01T00:00:00Z");
    expect(r).toEqual({
      time: "2026-01-01T00:00:00Z",
      level: "error",
      msg: "failed",
      code: 42,
    });
  });
});

describe("log emit", () => {
  it("writes an error as a JSON line to console.error", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    log.error("oops", new Error("bad"));
    expect(spy).toHaveBeenCalledOnce();
    const record = JSON.parse(spy.mock.calls[0][0] as string);
    expect(record).toMatchObject({ level: "error", msg: "oops", error: "bad" });
  });

  it("suppresses debug below the default (info) threshold", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    log.debug("quiet");
    expect(spy).not.toHaveBeenCalled();
  });

  it("emits debug when MC_LOG_LEVEL=debug", () => {
    process.env.MC_LOG_LEVEL = "debug";
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    log.debug("loud");
    expect(spy).toHaveBeenCalledOnce();
  });

  it("appends a JSON line to MC_LOG_FILE when set", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "mc-log-test-"));
    const file = path.join(dir, "log.jsonl");
    process.env.MC_LOG_FILE = file;
    vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      log.warn("to file", { n: 1 });
      const line = readFileSync(file, "utf8").trim();
      expect(JSON.parse(line)).toMatchObject({ level: "warn", msg: "to file", n: 1 });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
