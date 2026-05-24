"use client";

import { Plug } from "lucide-react";
import { Panel } from "@/components/panel";
import { WidgetState } from "@/components/widget-state";
import { usePluginQuery } from "@/components/plugin-data";
import { useSearch, matchesQuery } from "@/components/search";
import { useT } from "@/lib/i18n";
import { formatCompact, relativeTime } from "@/lib/format";
import { formatMs } from "@/lib/latency";
import type { McpServerUsage } from "@/lib/mcp-servers";

function errorColor(rate: number): string {
  if (rate <= 0) return "text-emerald-400";
  if (rate < 0.1) return "text-amber-400";
  return "text-red-400";
}

export function McpServers() {
  const { query } = useSearch();
  const { t, lang } = useT();
  const { data } = usePluginQuery<{ servers: McpServerUsage[] }>("/api/mcp?limit=50");
  const servers = data?.servers ?? null;

  const filtered = (servers ?? []).filter((s) => matchesQuery(query, s.server));
  const max = filtered.reduce((m, s) => Math.max(m, s.calls), 0) || 1;

  return (
    <Panel title={t("mcp.title")} icon={<Plug className="h-4 w-4 text-accent" />} info={t("mcp.info")}>
      {!servers ? (
        <WidgetState icon={Plug} title={t("common.loading")} loading />
      ) : servers.length === 0 ? (
        <WidgetState icon={Plug} title={t("mcp.empty")} description={t("mcp.emptyHint")} />
      ) : filtered.length === 0 ? (
        <WidgetState icon={Plug} title={t("common.noResults")} />
      ) : (
        <ul className="divide-y divide-panel-border/60">
          {filtered.map((s) => (
            <li key={s.server} className="mc-stream-in px-4 py-2.5">
              <div className="flex items-center gap-2">
                <Plug className="h-3.5 w-3.5 shrink-0 text-sky-400" />
                <span className="min-w-0 flex-1 truncate font-mono text-sm text-foreground" title={s.server}>
                  {s.server}
                </span>
                <span className="shrink-0 rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-accent">
                  {formatCompact(s.calls)}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.05]">
                <div className="h-full rounded-full bg-accent/70" style={{ width: `${(s.calls / max) * 100}%` }} />
              </div>
              <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted">
                <span className={`tabular-nums ${errorColor(s.errorRate)}`}>
                  {(s.errorRate * 100).toFixed(s.errorRate > 0 && s.errorRate < 0.1 ? 1 : 0)}% {t("mcp.errors")}
                </span>
                <span aria-hidden>·</span>
                <span className="tabular-nums">{formatMs(s.avgMs)}</span>
                <span aria-hidden>·</span>
                <span className="tabular-nums">
                  {s.tools} {t("mcp.tools")}
                </span>
                <span className="ml-auto shrink-0 whitespace-nowrap">{relativeTime(s.last_at, lang)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
