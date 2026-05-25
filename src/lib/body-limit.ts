// Read a request body with a hard byte cap. The naive `await req.text()` buffers
// the *entire* body into memory before any size check, so a chunked request with
// no Content-Length (or a lying header) can OOM the server before it's rejected.
// This reads the stream incrementally and aborts as soon as the cap is exceeded,
// counting real bytes (not UTF-16 code units).

export type CappedBody = { ok: true; text: string } | { ok: false };

export async function readBodyCapped(req: Request, maxBytes: number): Promise<CappedBody> {
  // Fast path: a declared length over the cap is an immediate reject.
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) return { ok: false };

  const body = req.body;
  if (!body) {
    // No stream (e.g. empty body) — text() is safe and small here.
    const text = await req.text();
    return Buffer.byteLength(text) > maxBytes ? { ok: false } : { ok: true, text };
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel(); // stop pulling — never buffer past the cap
        return { ok: false };
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return { ok: true, text: Buffer.concat(chunks).toString("utf8") };
}
