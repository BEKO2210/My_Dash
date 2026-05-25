import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { migrate } from "@/lib/migrations";
import { setConfig } from "@/lib/config";
import { getWebhookConfig, invalidateWebhookCache, isPrivateHost, webhookPayload } from "@/lib/webhook";

describe("webhookPayload", () => {
  it("uses Slack's text field by default", () => {
    expect(webhookPayload("https://hooks.slack.com/services/x", "hi")).toEqual({ text: "hi" });
  });

  it("uses Discord's content field for discord URLs", () => {
    expect(webhookPayload("https://discord.com/api/webhooks/x", "hi")).toEqual({ content: "hi" });
    expect(webhookPayload("https://discordapp.com/api/webhooks/x", "hi")).toEqual({ content: "hi" });
    expect(webhookPayload("https://canary.discord.com/api/webhooks/x", "hi")).toEqual({ content: "hi" });
  });

  it("does not treat look-alike hosts as Discord (anchored host match)", () => {
    expect(webhookPayload("https://discord.com.evil.example/x", "hi")).toEqual({ text: "hi" });
    expect(webhookPayload("https://evil.example/discord.com", "hi")).toEqual({ text: "hi" });
    expect(webhookPayload("not-a-url", "hi")).toEqual({ text: "hi" });
  });
});

describe("isPrivateHost (#89)", () => {
  it("flags loopback, link-local and private ranges", () => {
    for (const u of [
      "http://localhost:3000/x",
      "http://127.0.0.1/x",
      "https://10.0.0.5/x",
      "http://192.168.1.20/hook",
      "http://172.16.5.5/x",
      "http://169.254.1.1/x",
      "http://[::1]/x",
    ]) {
      expect(isPrivateHost(u), u).toBe(true);
    }
  });

  it("allows public webhook hosts (Slack/Discord) and 172.x outside the private block", () => {
    for (const u of [
      "https://hooks.slack.com/services/x",
      "https://discord.com/api/webhooks/x",
      "https://example.com/hook",
      "http://172.32.0.1/x", // 172.32 is public
    ]) {
      expect(isPrivateHost(u), u).toBe(false);
    }
  });

  it("returns false for an unparseable URL", () => {
    expect(isPrivateHost("not a url")).toBe(false);
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
