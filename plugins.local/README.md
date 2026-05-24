# Local / third-party widgets (`plugins.local/`)

Drop external widgets here to add them to the dashboard **without touching the
core**. Anything in this folder is scanned at build time and merged into the
widget registry.

## How it works

1. `npm run plugins:scan` (also runs automatically on `prebuild`) scans every
   sub-directory of `plugins.local/` for a `plugin.tsx` (or `plugin.ts`).
2. It (re)generates `src/plugins/external.generated.ts`, which the registry
   merges into `widgets`. The dashboard renders, the gallery groups, and the
   command palette finds your widget automatically — nothing else to wire.

## Authoring a widget

Create `plugins.local/<your-widget>/plugin.tsx`:

```tsx
"use client";

import { Sparkles } from "lucide-react";
import type { Widget } from "@/plugins/registry";
import { usePluginQuery } from "@/components/plugin-data"; // optional: typed data API

function MyWidget() {
  // const { data, loading } = usePluginQuery<MyShape>("/api/my-route");
  return <div className="p-4 text-sm text-foreground">Hello from my plugin</div>;
}

export const plugin: Widget = {
  id: "my-widget", // must be globally unique
  title: "My Widget",
  span: "lg:col-span-3",
  height: "h-[360px] min-[2560px]:h-[480px] min-[3840px]:h-[660px]",
  icon: Sparkles,
  category: "tools", // overview | sessions | economy | activity | tools | quality
  description: "kpi.info", // an i18n key (reuse an existing one or add your own)
  // settings: [{ key: "limit", type: "number", label: "...", default: 50 }],
  component: MyWidget,
};
```

## Rules of the road

- **Read-only.** Widgets only `GET` from the dashboard's own `/api/*` routes
  (use `usePluginQuery`) — never write. The one write path stays `/api/ingest`.
- **Unique `id`.** Collisions with a core widget will surface in the registry
  test and break the build.
- A broken plugin is isolated by the per-widget error boundary, so it can't take
  the rest of the dashboard down.

The generated `src/plugins/external.generated.ts` is committed but
auto-generated — don't hand-edit it, and don't commit your local plugin imports
into it.
