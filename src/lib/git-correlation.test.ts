import { describe, expect, it } from "vitest";
import { buildBranchCorrelations, type SessionGitRow } from "@/lib/git-correlation";

const row = (over: Partial<SessionGitRow>): SessionGitRow => ({
  id: "s",
  title: "t",
  branch: "main",
  remote_url: "git@github.com:owner/repo.git",
  project_name: "proj",
  last_seen: "2026-05-24 10:00:00",
  ...over,
});

describe("buildBranchCorrelations", () => {
  it("groups sessions by branch and derives repo + links", () => {
    const out = buildBranchCorrelations([
      row({ id: "a", branch: "feat/x", last_seen: "2026-05-24 12:00:00" }),
      row({ id: "b", branch: "feat/x", last_seen: "2026-05-24 11:00:00" }),
      row({ id: "c", branch: "main", last_seen: "2026-05-24 09:00:00" }),
    ]);
    expect(out).toHaveLength(2);
    const feat = out[0]; // sorted by last activity desc
    expect(feat.branch).toBe("feat/x");
    expect(feat.repo).toBe("owner/repo");
    expect(feat.sessionCount).toBe(2);
    expect(feat.sessions.map((s) => s.id)).toEqual(["a", "b"]);
    expect(feat.branchUrl).toBe("https://github.com/owner/repo/tree/feat%2Fx");
    expect(feat.prUrl).toBe("https://github.com/owner/repo/compare/feat%2Fx?expand=1");
    expect(feat.lastActivity).toBe("2026-05-24 12:00:00");
  });

  it("does not merge the same branch name across different repos", () => {
    const out = buildBranchCorrelations([
      row({ id: "a", branch: "main", remote_url: "git@github.com:owner/one.git" }),
      row({ id: "b", branch: "main", remote_url: "git@github.com:owner/two.git" }),
    ]);
    expect(out).toHaveLength(2);
    expect(new Set(out.map((b) => b.repo))).toEqual(new Set(["owner/one", "owner/two"]));
  });

  it("handles missing remotes (null links) and skips blank branches", () => {
    const out = buildBranchCorrelations([
      row({ id: "a", branch: "wip", remote_url: null }),
      row({ id: "b", branch: "  " }),
      row({ id: "c", branch: null }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ branch: "wip", repo: null, branchUrl: null, prUrl: null, sessionCount: 1 });
  });

  it("caps the listed sessions but keeps the full count", () => {
    const rows = Array.from({ length: 9 }, (_, i) => row({ id: `s${i}`, branch: "big" }));
    const out = buildBranchCorrelations(rows, 6);
    expect(out[0].sessionCount).toBe(9);
    expect(out[0].sessions).toHaveLength(6);
  });
});
