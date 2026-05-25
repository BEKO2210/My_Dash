import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { SessionRow } from "@/lib/types";

// git-sync writes onto the singleton db, so point it at a temp file before import.
let db: (typeof import("@/lib/db"))["db"];
let updateSessionGit: (typeof import("@/lib/git-sync"))["updateSessionGit"];
let scheduleGitUpdate: (typeof import("@/lib/git-sync"))["scheduleGitUpdate"];
let dataDir: string;

beforeAll(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), "mc-gitsync-test-"));
  process.env.MC_DATA_DIR = dataDir;
  ({ db } = await import("@/lib/db"));
  ({ updateSessionGit, scheduleGitUpdate } = await import("@/lib/git-sync"));
});

afterAll(() => {
  rmSync(dataDir, { recursive: true, force: true });
  delete process.env.MC_DATA_DIR;
});

const session = (id: string) =>
  db.prepare("SELECT branch, git_commit, remote_url FROM sessions WHERE id = ?").get(id) as
    | Pick<SessionRow, "branch" | "git_commit" | "remote_url">
    | undefined;

describe("updateSessionGit", () => {
  it("writes the commit (and branch) from a real git cwd", async () => {
    db.prepare("INSERT INTO sessions (id, status) VALUES ('g', 'active')").run();
    await updateSessionGit("g", process.cwd()); // the repo itself
    expect(session("g")!.git_commit).toMatch(/^[0-9a-f]{7,}$/);
  });

  it("leaves git fields null for a non-git cwd", async () => {
    db.prepare("INSERT INTO sessions (id, status) VALUES ('n', 'active')").run();
    await updateSessionGit("n", "/no/such/dir/xyz");
    const s = session("n")!;
    expect(s.git_commit).toBeNull();
    expect(s.branch).toBeNull();
  });
});

describe("scheduleGitUpdate", () => {
  it("is fire-and-forget and never throws on a bad cwd", () => {
    expect(() => scheduleGitUpdate("n2", "/no/such/dir/xyz")).not.toThrow();
  });
});
