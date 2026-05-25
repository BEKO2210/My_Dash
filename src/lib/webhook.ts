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
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    /* not a parseable URL — fall back to the Slack shape */
  }
  // Anchored on the host so e.g. "discord.com.evil.example" can't masquerade as
  // Discord; still allows subdomains like canary.discord.com.
  const isDiscord = /^(.+\.)?discord(app)?\.com$/.test(host);
  return isDiscord ? { content: message } : { text: message };
}

// Loopback / link-local / private-range hosts. We refuse to POST alerts to these
// by default so a webhook can't be pointed at an internal service (SSRF-style);
// set MC_WEBHOOK_ALLOW_PRIVATE=1 to permit a deliberately-local target.
export function isPrivateHost(url: string): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^\[|\]$/g, "");
  } catch {
    return false;
  }
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host === "::1") return true;
  if (host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd")) return true; // IPv6 link/unique-local
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a === 0 || a === 127) return true; // this-host / loopback
    if (a === 10) return true; // private
    if (a === 192 && b === 168) return true; // private
    if (a === 172 && b >= 16 && b <= 31) return true; // private
    if (a === 169 && b === 254) return true; // link-local
  }
  return false;
}

function allowPrivateWebhook(): boolean {
  return process.env.MC_WEBHOOK_ALLOW_PRIVATE === "1";
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
  // Don't reach internal services unless explicitly allowed (SSRF guard).
  if (isPrivateHost(url) && !allowPrivateWebhook()) return;
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
