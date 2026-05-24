import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// Read-only git context for a working directory. Runs on the local server (not in
// the hook), so the portable forwarder stays untouched and Claude is never blocked.
// Returns nulls when the directory isn't a git repo / git is unavailable.
export interface GitContext {
  branch: string | null;
  commit: string | null;
  remote: string | null;
}

export async function readGitContext(cwd: string): Promise<GitContext> {
  // Fixed args + execFile (no shell) → cwd from the payload can't inject commands.
  const run = async (args: string[]): Promise<string | null> => {
    try {
      const { stdout } = await execFileAsync("git", args, { cwd, timeout: 3000 });
      return stdout.trim() || null;
    } catch {
      return null;
    }
  };

  const [branch, commit, remote] = await Promise.all([
    run(["rev-parse", "--abbrev-ref", "HEAD"]),
    run(["rev-parse", "--short", "HEAD"]),
    run(["config", "--get", "remote.origin.url"]),
  ]);
  // "HEAD" means a detached checkout — no meaningful branch name.
  return { branch: branch === "HEAD" ? null : branch, commit, remote };
}
