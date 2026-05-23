import { db } from "./db";
import { log } from "./log";
import { summarizeTranscript } from "./transcript";

// Writes the transcript-derived token totals onto the session. Cache tokens and
// cost are layered on in a later run; here we populate the existing input/output
// columns so the dashboard shows real per-session usage without ccusage.
const setSessionUsage = db.prepare<[number, number, string]>(
  `UPDATE sessions SET token_input = ?, token_output = ? WHERE id = ?`,
);

export async function updateSessionUsage(sessionId: string, transcriptPath: string): Promise<void> {
  const summary = await summarizeTranscript(transcriptPath);
  if (!summary || summary.turns === 0) return;
  setSessionUsage.run(summary.inputTokens, summary.outputTokens, sessionId);
}

// Stop fires after every turn, so re-parsing the whole transcript each time would
// be wasteful. Throttle per session (SessionEnd forces a final parse). Runs
// fire-and-forget so it never blocks the ingest write path.
const THROTTLE_MS = 5000;
const lastSync = new Map<string, number>();

export function scheduleTranscriptUpdate(
  sessionId: string,
  transcriptPath: string,
  force = false,
): void {
  const now = Date.now();
  if (!force && now - (lastSync.get(sessionId) ?? 0) < THROTTLE_MS) return;
  lastSync.set(sessionId, now);
  if (lastSync.size > 1000) lastSync.clear(); // guard against unbounded growth
  void updateSessionUsage(sessionId, transcriptPath).catch((err) =>
    log.error("transcript sync failed", err),
  );
}
