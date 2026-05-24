"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { PluginConfig, PluginConfigMap } from "@/lib/plugin-config";

interface PluginConfigValue {
  all: PluginConfigMap;
  setConfig: (pluginId: string, config: PluginConfig) => void;
}

const Ctx = createContext<PluginConfigValue>({ all: {}, setConfig: () => {} });

// Loads every plugin's settings once and exposes an optimistic setter that POSTs
// to /api/plugins/config. A small local write path, settings-only.
export function PluginConfigProvider({ children }: { children: React.ReactNode }) {
  const [all, setAll] = useState<PluginConfigMap>({});

  useEffect(() => {
    let cancelled = false;
    fetch("/api/plugins/config")
      .then((r) => r.json())
      .then((d: { config: PluginConfigMap }) => {
        if (!cancelled) setAll(d.config ?? {});
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const setConfig = useCallback((pluginId: string, config: PluginConfig) => {
    setAll((prev) => ({ ...prev, [pluginId]: config }));
    fetch("/api/plugins/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pluginId, config }),
    }).catch(() => {});
  }, []);

  const value = useMemo(() => ({ all, setConfig }), [all, setConfig]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// Per-widget config accessor: current values + a single-key setter.
export function usePluginConfig(pluginId: string): {
  values: PluginConfig;
  set: (key: string, value: unknown) => void;
} {
  const { all, setConfig } = useContext(Ctx);
  const values = all[pluginId] ?? {};
  const set = useCallback(
    (key: string, value: unknown) => setConfig(pluginId, { ...(all[pluginId] ?? {}), [key]: value }),
    [all, pluginId, setConfig],
  );
  return { values, set };
}
