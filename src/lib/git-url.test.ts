import { describe, expect, it } from "vitest";
import { branchWebUrl, newPrUrl, parseRemoteUrl, repoSlug, repoWebUrl } from "@/lib/git-url";

describe("parseRemoteUrl", () => {
  it("parses scp-style ssh remotes", () => {
    expect(parseRemoteUrl("git@github.com:owner/repo.git")).toEqual({
      host: "github.com",
      owner: "owner",
      repo: "repo",
    });
  });

  it("parses https remotes with and without .git and user", () => {
    expect(parseRemoteUrl("https://github.com/owner/repo.git")).toEqual({ host: "github.com", owner: "owner", repo: "repo" });
    expect(parseRemoteUrl("https://user@github.com/owner/repo")).toEqual({ host: "github.com", owner: "owner", repo: "repo" });
  });

  it("parses ssh:// remotes and drops a port", () => {
    expect(parseRemoteUrl("ssh://git@github.com:22/owner/repo.git")).toEqual({
      host: "github.com",
      owner: "owner",
      repo: "repo",
    });
  });

  it("keeps GitLab subgroups in the repo path", () => {
    expect(parseRemoteUrl("git@gitlab.com:group/sub/repo.git")).toEqual({
      host: "gitlab.com",
      owner: "group",
      repo: "sub/repo",
    });
  });

  it("returns null for empty or unparseable input", () => {
    expect(parseRemoteUrl(null)).toBeNull();
    expect(parseRemoteUrl("")).toBeNull();
    expect(parseRemoteUrl("not-a-remote")).toBeNull();
  });
});

describe("url builders", () => {
  const gh = parseRemoteUrl("git@github.com:owner/repo.git")!;
  const gl = parseRemoteUrl("https://gitlab.com/group/repo.git")!;

  it("builds repo/branch URLs and encodes the branch", () => {
    expect(repoSlug(gh)).toBe("owner/repo");
    expect(repoWebUrl(gh)).toBe("https://github.com/owner/repo");
    expect(branchWebUrl(gh, "feat/x")).toBe("https://github.com/owner/repo/tree/feat%2Fx");
  });

  it("builds host-specific PR/MR links and null for unknown hosts", () => {
    expect(newPrUrl(gh, "feat/x")).toBe("https://github.com/owner/repo/compare/feat%2Fx?expand=1");
    expect(newPrUrl(gl, "feat/x")).toBe(
      "https://gitlab.com/group/repo/-/merge_requests/new?merge_request%5Bsource_branch%5D=feat%2Fx",
    );
    expect(newPrUrl({ host: "git.example.com", owner: "o", repo: "r" }, "b")).toBeNull();
  });
});
