import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseTranscriptMessages, readTranscriptText, type TranscriptMessage } from "@/lib/transcript";
import { redactSecrets } from "@/lib/prompt";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Read-only conversation for one session, re-parsed from the stored transcript
// path. Text/thinking blocks are redacted (the path comes from Claude Code hooks,
// never from the client).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "invalid id" }, { status: 400 });
  try {
    const row = db.prepare(`SELECT transcript_path FROM sessions WHERE id = ?`).get(id) as
      | { transcript_path: string | null }
      | undefined;
    if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (!row.transcript_path) return NextResponse.json({ messages: [], available: false });

    const text = await readTranscriptText(row.transcript_path);
    const messages = redactMessages(parseTranscriptMessages(text));
    return NextResponse.json({ messages, available: true });
  } catch (err) {
    log.error("/api/sessions/[id]/transcript failed", err);
    return NextResponse.json({ messages: [], available: false });
  }
}

function redactMessages(messages: TranscriptMessage[]): TranscriptMessage[] {
  return messages.map((m) => ({
    role: m.role,
    blocks: m.blocks.map((b) =>
      b.text != null ? { ...b, text: redactSecrets(b.text) } : b,
    ),
  }));
}
