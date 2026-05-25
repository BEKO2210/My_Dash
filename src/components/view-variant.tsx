"use client";

import { usePluginConfig } from "@/components/plugin-config";
import type { ViewOption, ViewVariant } from "@/plugins/registry";

// Phase F React layer for per-widget view variants. The pure helpers
// (`viewSetting`, `resolveView`, types) live in the registry; this is the
// client glue: read the persisted view, and an optional in-panel switch.
// Registry is imported types-only here so there's no runtime import cycle
// (registry → widget → view-variant).

/**
 * Current view for a widget — read from its persisted `view` setting, validated
 * against `options` and falling back to `def` (always a safe, known value).
 * (Mirrors the pure `resolveView` in the registry; inlined to keep this module
 * free of a runtime dependency on the registry.)
 */
export function useView<T extends ViewVariant>(widgetId: string, options: readonly T[], def: T): T {
  const { values } = usePluginConfig(widgetId);
  const v = values.view;
  return typeof v === "string" && (options as readonly string[]).includes(v) ? (v as T) : def;
}

/**
 * Optional compact segmented control for switching a widget's view from its
 * panel header (writes the same `view` config the settings drawer uses). Keep it
 * `controlled` — pass the value from `useView` so there's a single source.
 */
export function ViewSwitch<T extends ViewVariant>({
  widgetId,
  options,
  value,
  t,
}: {
  widgetId: string;
  options: ViewOption[];
  value: T;
  t: (key: string) => string;
}) {
  const { set } = usePluginConfig(widgetId);
  return (
    <div className="flex rounded-md border border-panel-border text-xs" role="group" aria-label={t("view.label")}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => set("view", o.value)}
          aria-pressed={value === o.value}
          className={`px-2 py-1 ${value === o.value ? "bg-accent/20 text-accent" : "text-muted hover:text-foreground"}`}
        >
          {t(o.label)}
        </button>
      ))}
    </div>
  );
}
