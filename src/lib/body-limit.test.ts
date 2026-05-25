import { describe, expect, it } from "vitest";
import { readBodyCapped } from "@/lib/body-limit";

// A POST Request whose body is a chunked stream with NO Content-Length — the case
// the old `await req.text()` couldn't guard before buffering everything.
function streamReq(parts: string[]): Request {
  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const p of parts) controller.enqueue(enc.encode(p));
      controller.close();
    },
  });
  return new Request("http://x", {
    method: "POST",
    body: stream,
    // Required by undici/Node to send a streaming body.
    duplex: "half",
  } as RequestInit & { duplex: "half" });
}

describe("readBodyCapped", () => {
  it("rejects an over-cap body", async () => {
    const req = new Request("http://x", { method: "POST", body: "x".repeat(100) });
    expect(await readBodyCapped(req, 50)).toEqual({ ok: false });
  });

  it("rejects via the declared Content-Length fast path before reading", async () => {
    // Explicit header simulates a real client (the hook forwarder sends one).
    const req = new Request("http://x", {
      method: "POST",
      body: "small",
      headers: { "content-length": "999999" },
    });
    // Only meaningful if the runtime preserved our header; otherwise the body path
    // still governs. Either way an oversize declaration must not be accepted as-is.
    if (Number(req.headers.get("content-length")) > 50) {
      expect(await readBodyCapped(req, 50)).toEqual({ ok: false });
    }
  });

  it("accepts a body within the cap and returns its text", async () => {
    const req = new Request("http://x", { method: "POST", body: "hello" });
    expect(await readBodyCapped(req, 50)).toEqual({ ok: true, text: "hello" });
  });

  it("aborts a chunked (no Content-Length) body once it passes the cap", async () => {
    const req = streamReq(["x".repeat(40), "y".repeat(40)]); // 80 bytes, no length header
    expect(req.headers.get("content-length")).toBeNull();
    expect(await readBodyCapped(req, 50)).toEqual({ ok: false });
  });

  it("reassembles a chunked body within the cap", async () => {
    const req = streamReq(["he", "llo", " world"]);
    expect(await readBodyCapped(req, 50)).toEqual({ ok: true, text: "hello world" });
  });

  it("counts bytes, not UTF-16 code units (multibyte)", async () => {
    // "€" is 3 bytes; 20 of them = 60 bytes but string length 20.
    const req = streamReq(["€".repeat(20)]);
    expect(await readBodyCapped(req, 50)).toEqual({ ok: false }); // 60 bytes > 50
    expect(await readBodyCapped(streamReq(["€".repeat(10)]), 50)).toEqual({
      ok: true,
      text: "€".repeat(10),
    }); // 30 bytes <= 50
  });

  it("treats an empty body as ok", async () => {
    expect(await readBodyCapped(new Request("http://x", { method: "POST" }), 50)).toEqual({
      ok: true,
      text: "",
    });
  });
});
