import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readGitContext } from "@/lib/git";

describe("readGitContext", () => {
  let dir: string | null = null;
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = null;
  });

  it("reads a commit for this repository", async () => {
    // The test process runs inside the project's git repo. The branch may be a
    // detached HEAD under CI, so only the commit is guaranteed.
    const ctx = await readGitContext(process.cwd());
    expect(ctx.commit).toMatch(/^[0-9a-f]{7,}$/);
  });

  it("returns nulls for a non-git directory", async () => {
    dir = mkdtempSync(path.join(tmpdir(), "mc-nogit-"));
    expect(await readGitContext(dir)).toEqual({ branch: null, commit: null });
  });

  it("returns nulls for a directory that doesn't exist", async () => {
    expect(await readGitContext("/no/such/dir/xyz")).toEqual({ branch: null, commit: null });
  });
});
