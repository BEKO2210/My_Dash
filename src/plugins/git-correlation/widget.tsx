"use client";

import Link from "next/link";
import { GitBranch, GitPullRequest, ExternalLink } from "lucide-react";
import { Panel } from "@/components/panel";
import { WidgetState } from "@/components/widget-state";
import { usePluginQuery } from "@/components/plugin-data";
import { useT } from "@/lib/i18n";
import { relativeTime } from "@/lib/format";
import type { BranchCorrelation } from "@/lib/git-correlation";

export function GitCorrelation() {
  const { t, lang } = useT();
  const { data } = usePluginQuery<{ branches: BranchCorrelation[] }>("/api/git/branches", { pollMs: 30_000 });

  return (
    <Panel
      title={t("gitcorr.title")}
      icon={<GitPullRequest className="h-4 w-4 text-accent" />}
      info={t("gitcorr.info")}
    >
      {!data ? (
        <WidgetState icon={GitPullRequest} title={t("common.loading")} loading />
      ) : data.branches.length === 0 ? (
        <WidgetState icon={GitBranch} title={t("gitcorr.empty")} />
      ) : (
        <ul className="divide-y divide-panel-border">
          {data.branches.map((b) => (
            <li key={`${b.repo ?? ""}/${b.branch}`} className="px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5">
                  <GitBranch className="h-3.5 w-3.5 shrink-0 text-muted" />
                  {b.branchUrl ? (
                    <a
                      href={b.branchUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="truncate font-mono text-xs text-foreground hover:text-accent"
                    >
                      {b.branch}
                    </a>
                  ) : (
                    <span className="truncate font-mono text-xs text-foreground">{b.branch}</span>
                  )}
                </span>
                {b.prUrl && (
                  <a
                    href={b.prUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="flex shrink-0 items-center gap-1 rounded-md border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px] text-accent transition-colors hover:bg-accent/20"
                  >
                    {t("gitcorr.openPr")}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10px] text-muted">
                <span>{b.repo ?? b.project ?? "—"}</span>
                <span aria-hidden>·</span>
                <span>
                  {b.sessionCount} {t("gitcorr.sessions")}
                </span>
                {b.lastActivity && (
                  <>
                    <span aria-hidden>·</span>
                    <span>{relativeTime(b.lastActivity, lang)}</span>
                  </>
                )}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {b.sessions.map((s) => (
                  <Link
                    key={s.id}
                    href={`/session?id=${encodeURIComponent(s.id)}`}
                    title={s.title ?? s.id}
                    className="max-w-[14rem] truncate rounded bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-muted transition-colors hover:bg-white/[0.08] hover:text-foreground"
                  >
                    {s.title ?? s.id}
                  </Link>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
