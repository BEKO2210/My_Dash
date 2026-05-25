import { z } from "zod";
import type { HookPayload } from "./types";

// Tolerant validation for the single write path (/api/ingest). Every field is
// optional and unknown keys pass through (hook payloads vary per event and evolve
// across Claude Code versions), but a known field that IS present must have the
// right type — a wrong type is treated as a malformed request.
export const HookPayloadSchema = z.looseObject({
  session_id: z.string().optional(),
  transcript_path: z.string().optional(),
  cwd: z.string().optional(),
  hook_event_name: z.string().optional(),
  tool_name: z.string().optional(),
  tool_use_id: z.string().optional(),
  tool_input: z.record(z.string(), z.unknown()).optional(),
  tool_response: z.unknown().optional(),
  prompt: z.string().optional(),
  message: z.string().optional(),
  source: z.string().optional(),
  reason: z.string().optional(),
  trigger: z.string().optional(),
});

export type HookPayloadParse =
  | { ok: true; payload: HookPayload }
  | { ok: false; error: string };

export function parseHookPayload(input: unknown): HookPayloadParse {
  const result = HookPayloadSchema.safeParse(input);
  if (!result.success) {
    const error = result.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    return { ok: false, error };
  }
  return { ok: true, payload: result.data as HookPayload };
}
