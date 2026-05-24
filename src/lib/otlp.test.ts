import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import {
  attrValue,
  flattenAttributes,
  insertLogs,
  insertMetrics,
  parseLogs,
  parseMetrics,
} from "@/lib/otlp";
import { migrate } from "@/lib/migrations";

let open: Database.Database | null = null;
afterEach(() => {
  open?.close();
  open = null;
});

describe("attrValue", () => {
  it("extracts each OTLP scalar shape and coerces stringly numbers", () => {
    expect(attrValue({ stringValue: "input" })).toBe("input");
    expect(attrValue({ intValue: "5000" })).toBe(5000);
    expect(attrValue({ doubleValue: "0.0342" })).toBe(0.0342);
    expect(attrValue({ boolValue: true })).toBe(true);
    expect(attrValue({})).toBeNull();
    expect(attrValue("nope")).toBeNull();
  });
});

describe("flattenAttributes", () => {
  it("builds a plain object and skips keyless/empty entries", () => {
    const out = flattenAttributes([
      { key: "model", value: { stringValue: "claude-sonnet-4-6" } },
      { key: "input_tokens", value: { intValue: "1250" } },
      { value: { stringValue: "orphan" } },
      { key: "blank", value: {} },
    ]);
    expect(out).toEqual({ model: "claude-sonnet-4-6", input_tokens: 1250 });
  });
});

const metricsBody = {
  resourceMetrics: [
    {
      resource: { attributes: [{ key: "service.name", value: { stringValue: "claude-code" } }] },
      scopeMetrics: [
        {
          scope: { name: "com.anthropic.claude_code" },
          metrics: [
            {
              name: "claude_code.token.usage",
              sum: {
                dataPoints: [
                  {
                    attributes: [
                      { key: "type", value: { stringValue: "input" } },
                      { key: "model", value: { stringValue: "claude-sonnet-4-6" } },
                      { key: "session.id", value: { stringValue: "sess-1" } },
                    ],
                    asInt: "5000",
                    timeUnixNano: "1700000000000000000",
                  },
                ],
              },
            },
            {
              name: "claude_code.cost.usage",
              sum: {
                dataPoints: [{ attributes: [{ key: "session.id", value: { stringValue: "sess-1" } }], asDouble: "0.0342" }],
              },
            },
          ],
        },
      ],
    },
  ],
};

describe("parseMetrics", () => {
  it("flattens sum/gauge data points and promotes session + model", () => {
    const rows = parseMetrics(metricsBody);
    expect(rows).toHaveLength(2);
    const token = rows[0];
    expect(token.name).toBe("claude_code.token.usage");
    expect(token.sessionId).toBe("sess-1");
    expect(token.model).toBe("claude-sonnet-4-6");
    expect(token.value).toBe(5000);
    expect(token.ts).toBe(new Date(1700000000000).toISOString());
    expect(token.attrs["service.name"]).toBe("claude-code"); // resource attrs merged in

    const cost = rows[1];
    expect(cost.value).toBeCloseTo(0.0342);
    expect(cost.model).toBeNull();
    expect(cost.ts).toBeNull();
  });

  it("returns [] for empty or malformed bodies", () => {
    expect(parseMetrics({})).toEqual([]);
    expect(parseMetrics(null)).toEqual([]);
    expect(parseMetrics({ resourceMetrics: "x" })).toEqual([]);
  });
});

const logsBody = {
  resourceLogs: [
    {
      resource: { attributes: [{ key: "service.name", value: { stringValue: "claude-code" } }] },
      scopeLogs: [
        {
          logRecords: [
            {
              timeUnixNano: "1700000000000000000",
              body: { stringValue: "api_request" },
              attributes: [
                { key: "event.name", value: { stringValue: "api_request" } },
                { key: "model", value: { stringValue: "claude-sonnet-4-6" } },
                { key: "session.id", value: { stringValue: "sess-1" } },
                { key: "output_tokens", value: { intValue: "340" } },
              ],
            },
          ],
        },
      ],
    },
  ],
};

describe("parseLogs", () => {
  it("uses event.name, promotes session/model, and keeps the body", () => {
    const rows = parseLogs(logsBody);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("api_request");
    expect(rows[0].sessionId).toBe("sess-1");
    expect(rows[0].model).toBe("claude-sonnet-4-6");
    expect(rows[0].body).toBe("api_request");
    expect(rows[0].attrs.output_tokens).toBe(340);
  });

  it("falls back to the body when event.name is absent, and skips nameless records", () => {
    const fallback = parseLogs({
      resourceLogs: [{ scopeLogs: [{ logRecords: [{ body: { stringValue: "user_prompt" } }, {}] }] }],
    });
    expect(fallback).toHaveLength(1);
    expect(fallback[0].name).toBe("user_prompt");
  });
});

describe("insert", () => {
  it("writes parsed rows into the isolated otlp tables", () => {
    const db = (open = new Database(":memory:"));
    migrate(db);
    expect(insertMetrics(parseMetrics(metricsBody), db)).toBe(2);
    expect(insertLogs(parseLogs(logsBody), db)).toBe(1);

    const m = db.prepare("SELECT name, session_id, value FROM otlp_metric ORDER BY id").all() as {
      name: string;
      session_id: string;
      value: number;
    }[];
    expect(m[0]).toMatchObject({ name: "claude_code.token.usage", session_id: "sess-1", value: 5000 });

    const l = db.prepare("SELECT name, model FROM otlp_log").get() as { name: string; model: string };
    expect(l).toMatchObject({ name: "api_request", model: "claude-sonnet-4-6" });
  });

  it("no-ops on empty input", () => {
    const db = (open = new Database(":memory:"));
    migrate(db);
    expect(insertMetrics([], db)).toBe(0);
    expect(insertLogs([], db)).toBe(0);
  });
});
