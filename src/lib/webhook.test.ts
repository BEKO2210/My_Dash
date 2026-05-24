import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { migrate } from "@/lib/migrations";
import { setConfig } from "@/lib/config";
import { getWebhookConfig, invalidateWebhookCache, webhookPayload } from "@/lib/webhook";

describe("webhookPayload", () => {
  it("uses Slack's text field by default", () => {
    expect(webhookPayload("https://hooks.slack.com/services/x", "hi")).toEqual({ text: "hi" });
  });

  it("uses Discord's content field for discord URLs", () => {
    expect(webhookPayload("https://discord.com/api/webhooks/x", "hi")).toEqual({ content: "hi" });
    expect(webhookPayload("https://discordapp.com/api/webhooks/x", "hi")).toEqual({ content: "hi" });
  });
});

describe("getWebhookConfig", () => {
  let open: Database.Database | null = null;
  afterEach(() => {
    open?.close();
    open = null;
    invalidateWebhookCache();
  });

  it("is disabled with no URL by default", () => {
    const db = (open = new Database(":memory:"));
    migrate(db);
    invalidateWebhookCache();
    expect(getWebhookConfig(db)).toEqual({ url: "", enabled: false });
  });

  it("reads stored url + enabled flag", () => {
    const db = (open = new Database(":memory:"));
    migrate(db);
    setConfig(db, "webhook.url", "https://hooks.slack.com/x");
    setConfig(db, "webhook.enabled", "1");
    invalidateWebhookCache();
    expect(getWebhookConfig(db)).toEqual({ url: "https://hooks.slack.com/x", enabled: true });
  });
});
