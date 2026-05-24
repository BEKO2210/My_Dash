"use client";

// Reference third-party plugin. Lives entirely outside src/ in plugins.local/ and
// is merged into the dashboard by the build-time scan (scripts/scan-plugins.mjs) —
// no core files touched. Copy this folder as a starting point for your own widget.
//
// It demonstrates the seam: the manifest (`export const plugin: Widget`), the
// typed read-only data API (usePluginQuery), and the shared Panel chrome. Strings
// are literal here so a plugin needs no access to the core i18n catalogue.

import { Sparkles } from "lucide-react";
import { Panel } from "@/components/panel";
import { WidgetState } from "@/components/widget-state";
import { usePluginQuery } from "@/components/plugin-data";
import { formatCompact } from "@/lib/format";
import type { Widget } from "@/plugins/registry";

interface Stats {
  eventsToday: number;
  toolCallsToday: number;
}

function ReferencePlugin() {
  const { data } = usePluginQuery<Stats>("/api/stats", { pollMs: 15_000 });
  return (
    <Panel
      title="Reference Plugin"
      icon={<Sparkles className="h-4 w-4 text-accent" />}
      info="Example third-party widget loaded from plugins.local/ — read-only, via usePluginQuery."
    >
      {!data ? (
        <WidgetState icon={Sparkles} title="Loading…" loading />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
          <Sparkles className="h-7 w-7 text-accent" />
          <p className="text-sm text-foreground">Hello from a third-party plugin</p>
          <p className="text-xs text-muted">
            {formatCompact(data.eventsToday)} events · {formatCompact(data.toolCallsToday)} tool calls today
          </p>
          <p className="max-w-xs text-[11px] text-muted">
            Defined in <code className="text-accent">plugins.local/reference/plugin.tsx</code>.
          </p>
        </div>
      )}
    </Panel>
  );
}

export const plugin: Widget = {
  id: "reference-plugin",
  title: "Reference Plugin",
  span: "lg:col-span-3",
  height: "h-[360px] min-[2560px]:h-[480px] min-[3840px]:h-[660px]",
  icon: Sparkles,
  category: "tools",
  description: "Example third-party widget — see plugins.local/README.md.",
  component: ReferencePlugin,
};
