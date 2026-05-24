import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { migrate } from "@/lib/migrations";
import { buildDigest, renderDigestHtml, type DigestData } from "@/lib/digest";

let open: Database.Database | null = null;
afterEach(() => {
  open?.close();
  open = null;
});

describe("buildDigest", () => {
  it("summarizes the window from the DB", () => {
    const db = (open = new Database(":memory:"));
    migrate(db);
    const now = new Date("2026-05-24T12:00:00Z");
    const within = "2026-05-24 09:00:00";
    db.prepare(`INSERT INTO sessions (id, first_seen, cost_usd) VALUES (?, ?, ?)`).run("s1", within, 3.5);
    db.prepare(`INSERT INTO events (session_id, event_type, payload_json, created_at) VALUES (?, ?, '{}', ?)`).run("s1", "PostToolUse", within);
    const tc = db.prepare(`INSERT INTO tool_calls (session_id, tool_name, success, created_at) VALUES (?, ?, ?, ?)`);
    tc.run("s1", "Read", 1, within);
    tc.run("s1", "Bash", 0, within);

    const d = buildDigest(db, "day", now);
    expect(d.period).toBe("day");
    expect(d.events).toBe(1);
    expect(d.sessions).toBe(1);
    expect(d.toolCalls).toBe(2);
    expect(d.failures).toBe(1);
    expect(d.costUsd).toBe(3.5);
    expect(d.topTools.map((t) => t.tool)).toContain("Read");
    expect(d.topErrors.map((t) => t.tool)).toContain("Bash");
  });
});

describe("renderDigestHtml", () => {
  const data: DigestData = {
    period: "week",
    since: "2026-05-17 12:00:00",
    generatedAt: "2026-05-24 12:00:00",
    events: 120,
    toolCalls: 80,
    failures: 4,
    sessions: 12,
    costUsd: 9.42,
    errorRate: 0.05,
    topTools: [{ tool: "Read", count: 40 }],
    topErrors: [{ tool: "Bash", failures: 4, total: 20, rate: 0.2 }],
  };

  it("renders an HTML doc with the headline numbers", () => {
    const html = renderDigestHtml(data);
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("Weekly digest");
    expect(html).toContain("$9.42");
    expect(html).toContain("Read");
    expect(html).toContain("Bash");
  });

  it("escapes HTML in tool names", () => {
    const html = renderDigestHtml({ ...data, topTools: [{ tool: "<script>", count: 1 }] });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
