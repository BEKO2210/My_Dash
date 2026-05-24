// Parse a git `origin` remote URL into a web repo reference and build branch / "open
// PR" links from it. Pure and host-aware (GitHub + GitLab patterns), so the Git
// correlation view can link out without any network access or API tokens.

export interface RepoRef {
  host: string;
  owner: string;
  repo: string;
}

// Handles scp-style (git@host:owner/repo.git), ssh:// and https:// remotes.
export function parseRemoteUrl(remote: string | null | undefined): RepoRef | null {
  if (!remote) return null;
  const url = remote.trim();
  if (!url) return null;

  let host: string;
  let path: string;

  const scp = /^[^/@]+@([^:/]+):(.+)$/.exec(url); // git@github.com:owner/repo.git
  if (scp) {
    host = scp[1];
    path = scp[2];
  } else {
    let rest = url.replace(/^[a-z][a-z0-9+.-]*:\/\//i, ""); // strip scheme://
    rest = rest.replace(/^[^/@]+@/, ""); // strip user@
    const slash = rest.indexOf("/");
    if (slash < 0) return null;
    host = rest.slice(0, slash);
    path = rest.slice(slash + 1);
  }

  host = host.replace(/:\d+$/, ""); // drop a port if present
  const parts = path
    .replace(/\.git$/i, "")
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .filter(Boolean);
  if (parts.length < 2 || !host) return null;

  const owner = parts[0];
  const repo = parts.slice(1).join("/"); // GitLab subgroups: owner/sub/repo
  return { host, owner, repo };
}

export function repoSlug(ref: RepoRef): string {
  return `${ref.owner}/${ref.repo}`;
}

export function repoWebUrl(ref: RepoRef): string {
  return `https://${ref.host}/${ref.owner}/${ref.repo}`;
}

export function branchWebUrl(ref: RepoRef, branch: string): string {
  return `${repoWebUrl(ref)}/tree/${encodeURIComponent(branch)}`;
}

// "Open a PR/MR for this branch" link. GitHub and GitLab use different paths; other
// hosts get null (the branch link is still shown).
export function newPrUrl(ref: RepoRef, branch: string): string | null {
  const b = encodeURIComponent(branch);
  if (ref.host.includes("github")) return `${repoWebUrl(ref)}/compare/${b}?expand=1`;
  if (ref.host.includes("gitlab")) {
    return `${repoWebUrl(ref)}/-/merge_requests/new?merge_request%5Bsource_branch%5D=${b}`;
  }
  return null;
}
