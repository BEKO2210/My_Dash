import { db } from "./db";
import { readGitContext } from "./git";
import { log } from "./log";

const setSessionGit = db.prepare<[string | null, string | null, string | null, string]>(
  `UPDATE sessions SET branch = ?, git_commit = ?, remote_url = ? WHERE id = ?`,
);

export async function updateSessionGit(sessionId: string, cwd: string): Promise<void> {
  const { branch, commit, remote } = await readGitContext(cwd);
  if (!branch && !commit && !remote) return;
  setSessionGit.run(branch, commit, remote, sessionId);
}

// Fire-and-forget; called once at SessionStart so it never blocks ingest.
export function scheduleGitUpdate(sessionId: string, cwd: string): void {
  void updateSessionGit(sessionId, cwd).catch((err) => log.error("git context sync failed", err));
}
