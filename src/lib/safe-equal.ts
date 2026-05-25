import { timingSafeEqual } from "node:crypto";

// Constant-time string comparison for secrets (the hook token), so the response
// time can't leak how many leading characters matched. Length is compared first
// because timingSafeEqual requires equal-length buffers — a length difference is
// not itself the secret.
export function timingSafeStrEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
