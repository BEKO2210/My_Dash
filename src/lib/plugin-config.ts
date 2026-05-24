import type Database from "better-sqlite3";

// Per-plugin settings: a small JSON object keyed by widget id. Persisted in the
// plugin_config table and read by the settings drawer + the widgets themselves.

export type PluginConfig = Record<string, unknown>;
export type PluginConfigMap = Record<string, PluginConfig>;

function parse(json: string): PluginConfig {
  try {
    const v = JSON.parse(json);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as PluginConfig) : {};
  } catch {
    return {};
  }
}

export function getAllPluginConfig(db: Database.Database): PluginConfigMap {
  const rows = db.prepare(`SELECT plugin_id, config_json FROM plugin_config`).all() as {
    plugin_id: string;
    config_json: string;
  }[];
  const out: PluginConfigMap = {};
  for (const r of rows) out[r.plugin_id] = parse(r.config_json);
  return out;
}

export function getPluginConfig(db: Database.Database, pluginId: string): PluginConfig {
  const row = db.prepare(`SELECT config_json FROM plugin_config WHERE plugin_id = ?`).get(pluginId) as
    | { config_json: string }
    | undefined;
  return row ? parse(row.config_json) : {};
}

export function setPluginConfig(db: Database.Database, pluginId: string, config: PluginConfig): void {
  db.prepare(
    `INSERT INTO plugin_config (plugin_id, config_json, updated_at)
     VALUES (?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(plugin_id) DO UPDATE SET config_json = excluded.config_json, updated_at = CURRENT_TIMESTAMP`,
  ).run(pluginId, JSON.stringify(config ?? {}));
}
