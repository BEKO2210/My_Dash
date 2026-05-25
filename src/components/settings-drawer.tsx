"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { useT } from "@/lib/i18n";
import { usePluginConfig } from "@/components/plugin-config";
import { widgets, widgetTitle, type PluginSetting } from "@/plugins/registry";

export function SettingsDrawer({ widgetId, onClose }: { widgetId: string; onClose: () => void }) {
  const { t } = useT();
  const widget = widgets.find((w) => w.id === widgetId);
  const { values, set } = usePluginConfig(widgetId);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const settings = widget?.settings ?? [];

  return (
    <div className="fixed inset-0 z-[75] flex justify-end" role="dialog" aria-modal="true" aria-label={t("settings.title")}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative z-10 flex h-full w-full max-w-sm flex-col border-l border-panel-border bg-panel shadow-2xl shadow-black/50">
        <header className="flex items-center justify-between border-b border-panel-border px-4 py-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-muted">{t("settings.title")}</p>
            <h2 className="truncate text-sm font-semibold text-foreground">{widget ? widgetTitle(widget, t) : widgetId}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label={t("common.close")} title={t("common.close")} className="text-muted hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1 space-y-4 overflow-auto p-4">
          {settings.length === 0 ? (
            <p className="text-xs text-muted">{t("settings.none")}</p>
          ) : (
            settings.map((s) => <SettingRow key={s.key} setting={s} value={values[s.key]} onChange={(v) => set(s.key, v)} t={t} />)
          )}
        </div>
      </div>
    </div>
  );
}

function SettingRow({
  setting,
  value,
  onChange,
  t,
}: {
  setting: PluginSetting;
  value: unknown;
  onChange: (v: unknown) => void;
  t: (k: string) => string;
}) {
  if (setting.type === "boolean") {
    const on = typeof value === "boolean" ? value : setting.default;
    return (
      <label className="flex items-center justify-between gap-3 text-sm text-foreground">
        <span>{t(setting.label)}</span>
        <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-[var(--color-accent)]" />
      </label>
    );
  }
  if (setting.type === "number") {
    const n = typeof value === "number" ? value : setting.default;
    return (
      <label className="block text-sm text-foreground">
        <span className="mb-1 block">{t(setting.label)}</span>
        <input
          type="number"
          value={n}
          min={setting.min}
          max={setting.max}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full rounded-md border border-panel-border bg-background/40 px-2 py-1 text-xs text-foreground outline-none focus:border-accent"
        />
      </label>
    );
  }
  const sel = typeof value === "string" ? value : setting.default;
  return (
    <label className="block text-sm text-foreground">
      <span className="mb-1 block">{t(setting.label)}</span>
      <select
        value={sel}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-panel-border bg-background/40 px-2 py-1 text-xs text-foreground outline-none focus:border-accent"
      >
        {setting.options.map((o) => (
          <option key={o.value} value={o.value}>
            {t(o.label)}
          </option>
        ))}
      </select>
    </label>
  );
}
