"use client";

import { Flame } from "lucide-react";
import { Panel } from "@/components/panel";
import { WidgetState } from "@/components/widget-state";
import { usePluginQuery } from "@/components/plugin-data";
import { useT } from "@/lib/i18n";
import { formatCompact } from "@/lib/format";
import type { ToolTokenBurn } from "@/lib/token-burn";

export function TokenBurn() {
  const { t } = useT();
  const { data } = usePluginQuery<{ tools: ToolTokenBurn[] }>("/api/token-burn?limit=8");
  const tools = data?.tools ?? null;

  const empty = tools && (tools.length === 0 || tools.every((t) => t.tokens === 0));
  const max = (tools ?? []).reduce((m, t) => Math.max(m, t.tokens), 0) || 1;

  return (
    <Panel title={t("burn.title")} icon={<Flame className="h-4 w-4 text-accent" />} info={t("burn.info")}>
      {!tools ? (
        <WidgetState icon={Flame} title={t("common.loading")} loading />
      ) : empty ? (
        <WidgetState icon={Flame} title={t("burn.empty")} />
      ) : (
        <ul className="flex h-full flex-col justify-center gap-2.5 p-4">
          {tools.map((tool) => (
            <li key={tool.tool} className="mc-stream-in">
              <div className="mb-0.5 flex items-baseline justify-between gap-2 text-xs">
                <span className="truncate font-mono text-foreground" title={tool.tool}>
                  {tool.tool}
                </span>
                <span className="shrink-0 tabular-nums text-muted">
                  <span className="text-foreground">~{formatCompact(tool.tokens)}</span> ·{" "}
                  {(tool.share * 100).toFixed(0)}% · {tool.calls}×
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.05]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-accent/60 to-accent transition-[width]"
                  style={{ width: `${(tool.tokens / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
