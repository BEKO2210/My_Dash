import type Database from "better-sqlite3";
import { getConfig } from "./config";

// Optional outbound webhook for alerts (Slack / Discord). OFF by default — only
// sends when explicitly enabled with a URL. Pure payload building is testable;
// the actual POST is fire-and-forget and never blocks ingest.

export interface WebhookConfig {
  url: string;
  enabled: boolean;
}

// Slack expects { text }, Discord expects { content }. Pick by URL host so a
// single config field works for either.
export function webhookPayload(url: string, message: string): Record<string, string> {
  return /discord(app)?\.com/i.test(url) ? { content: message } : { text: message };
}

let cache: WebhookConfig | null = null;
let cacheAt = 0;

export function getWebhookConfig(db: Database.Database): WebhookConfig {
  const now = Date.now();
  if (cache && now - cacheAt < 60_000) return cache;
  cache = {
    url: getConfig(db, "webhook.url") ?? "",
    enabled: getConfig(db, "webhook.enabled") === "1",
  };
  cacheAt = now;
  return cache;
}

export function invalidateWebhookCache(): void {
  cache = null;
}

// Fire-and-forget POST. Times out quickly so a dead webhook can't wedge ingest.
export async function sendAlertWebhook(url: string, message: string): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(webhookPayload(url, message)),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}
