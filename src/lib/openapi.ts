// Hand-maintained OpenAPI 3.1 description of the dashboard's HTTP surface: every
// read path plus the single write path (/api/ingest). Built from a compact route
// table so it stays close to the code and easy to extend. Served by /api/openapi.

interface RouteDef {
  method: "get" | "post";
  path: string;
  tag: string;
  summary: string;
  params?: string[]; // names of shared parameters (see PARAMS) and inline ones
  inline?: Record<string, unknown>[]; // extra inline parameter objects
  request?: Record<string, unknown>; // requestBody object
  responses?: Record<string, unknown>; // overrides the default 200 JSON
}

const PARAMS: Record<string, Record<string, unknown>> = {
  limit: { name: "limit", in: "query", description: "Max rows to return.", schema: { type: "integer", minimum: 1 } },
  days: { name: "days", in: "query", description: "Look-back window in days.", schema: { type: "integer", minimum: 1 } },
  id: { name: "id", in: "path", required: true, description: "Resource id.", schema: { type: "string" } },
};

const jsonObject = { type: "object", additionalProperties: true };

function ok(description: string, schema: Record<string, unknown> = jsonObject) {
  return { "200": { description, content: { "application/json": { schema } } } };
}

const ROUTES: RouteDef[] = [
  // Overview / system
  { method: "get", path: "/api/stats", tag: "overview", summary: "Headline KPIs for the status strip." },
  { method: "get", path: "/api/health", tag: "system", summary: "Liveness + basic DB stats." },
  {
    method: "get",
    path: "/api/metrics",
    tag: "system",
    summary: "Prometheus metrics (text exposition format 0.0.4).",
    responses: { "200": { description: "Prometheus metrics.", content: { "text/plain": { schema: { type: "string" } } } } },
  },
  {
    method: "get",
    path: "/api/stream",
    tag: "system",
    summary: "Live event stream (Server-Sent Events).",
    inline: [{ name: "lastEventId", in: "query", description: "Resume after this event id.", schema: { type: "integer" } }],
    responses: { "200": { description: "SSE stream.", content: { "text/event-stream": { schema: { type: "string" } } } } },
  },
  {
    method: "get",
    path: "/api/digest",
    tag: "system",
    summary: "Daily/weekly digest as HTML.",
    inline: [
      { name: "period", in: "query", description: "Digest period.", schema: { type: "string", enum: ["day", "week"] } },
      { name: "format", in: "query", schema: { type: "string" } },
    ],
    responses: { "200": { description: "Digest HTML.", content: { "text/html": { schema: { type: "string" } } } } },
  },
  {
    method: "get",
    path: "/api/export",
    tag: "system",
    summary: "Export data. No table → JSON bundle of all tables; otherwise one table.",
    inline: [
      {
        name: "table",
        in: "query",
        description: "sessions|events|tool_calls|prompts|alerts|alert_rules|otlp_metric|otlp_log",
        schema: { type: "string" },
      },
      { name: "format", in: "query", schema: { type: "string", enum: ["json", "csv"] } },
    ],
    responses: {
      "200": {
        description: "File download (JSON or CSV).",
        content: { "application/json": { schema: jsonObject }, "text/csv": { schema: { type: "string" } } },
      },
    },
  },
  { method: "get", path: "/api/plugins/config", tag: "system", summary: "Per-widget settings." },
  {
    method: "post",
    path: "/api/plugins/config",
    tag: "system",
    summary: "Update a widget's settings.",
    request: body({ pluginId: { type: "string" }, config: { type: "object", additionalProperties: true } }),
  },

  // Sessions
  { method: "get", path: "/api/sessions", tag: "sessions", summary: "All sessions (kanban data) with derived counts." },
  { method: "get", path: "/api/sessions/{id}", tag: "sessions", summary: "One session with detail aggregates.", params: ["id"] },
  {
    method: "get",
    path: "/api/sessions/{id}/transcript",
    tag: "sessions",
    summary: "A session's redacted transcript.",
    params: ["id"],
  },
  { method: "get", path: "/api/events", tag: "sessions", summary: "Recent events.", params: ["limit"], inline: [{ name: "since", in: "query", schema: { type: "integer" } }, { name: "session", in: "query", schema: { type: "string" } }] },
  { method: "get", path: "/api/events/{id}", tag: "sessions", summary: "One event.", params: ["id"] },
  { method: "get", path: "/api/prompts", tag: "sessions", summary: "Recent prompts (redacted).", params: ["limit"] },
  { method: "get", path: "/api/subagents", tag: "sessions", summary: "Subagent tree.", params: ["limit"] },
  { method: "get", path: "/api/session-duration", tag: "sessions", summary: "Session-duration distribution." },
  { method: "get", path: "/api/git/branches", tag: "sessions", summary: "Sessions grouped by git branch, with PR links." },
  {
    method: "get",
    path: "/api/search",
    tag: "sessions",
    summary: "Full-text search over prompts + event summaries.",
    params: ["limit"],
    inline: [{ name: "q", in: "query", required: true, schema: { type: "string" } }],
  },

  // Economy
  { method: "get", path: "/api/usage", tag: "economy", summary: "ccusage report (tokens, cost, models, blocks)." },
  { method: "get", path: "/api/usage/projects", tag: "economy", summary: "Per-project usage.", params: ["limit"] },
  { method: "get", path: "/api/usage/sessions", tag: "economy", summary: "Per-session usage." },
  { method: "get", path: "/api/usage/reconcile", tag: "economy", summary: "Per-session cost reconciled across sources." },
  { method: "get", path: "/api/budget", tag: "economy", summary: "Budget status + projection." },
  { method: "get", path: "/api/token-burn", tag: "economy", summary: "Token consumption per tool.", params: ["limit"] },

  // Activity
  { method: "get", path: "/api/activity", tag: "activity", summary: "Hourly activity rollup.", params: ["limit"] },
  { method: "get", path: "/api/calendar", tag: "activity", summary: "Year calendar heatmap.", params: ["days"] },
  { method: "get", path: "/api/streak", tag: "activity", summary: "Streak + productivity.", params: ["days"] },
  { method: "get", path: "/api/velocity", tag: "activity", summary: "Velocity trend.", params: ["days"] },

  // Tools
  { method: "get", path: "/api/tools", tag: "tools", summary: "Top tools.", params: ["limit", "days"] },
  { method: "get", path: "/api/tools/latency", tag: "tools", summary: "Tool latency.", inline: [{ name: "tool", in: "query", schema: { type: "string" } }] },
  { method: "get", path: "/api/tool-calls/{id}", tag: "tools", summary: "One tool call's I/O.", params: ["id"] },
  { method: "get", path: "/api/files", tag: "tools", summary: "File hotspots.", params: ["limit", "days"] },
  { method: "get", path: "/api/graph", tag: "tools", summary: "Tool-call graph.", inline: [{ name: "sessions", in: "query", schema: { type: "string" } }] },
  { method: "get", path: "/api/sankey", tag: "tools", summary: "Tool flow (sankey)." },
  { method: "get", path: "/api/mcp", tag: "tools", summary: "MCP server activity.", params: ["limit"] },
  { method: "get", path: "/api/tags", tag: "tools", summary: "Topic cloud.", params: ["limit"] },

  // Quality
  { method: "get", path: "/api/errors", tag: "quality", summary: "Recent errors.", params: ["limit", "days"] },
  { method: "get", path: "/api/reliability", tag: "quality", summary: "Reliability per project.", params: ["limit"] },
  { method: "get", path: "/api/compactions", tag: "quality", summary: "Compaction timeline.", params: ["limit"] },
  { method: "get", path: "/api/anomaly", tag: "quality", summary: "Anomaly detection (24h vs 7d baseline)." },

  // Alerting
  { method: "get", path: "/api/alerts", tag: "alerts", summary: "Recent alerts + unread count.", params: ["limit"] },
  {
    method: "post",
    path: "/api/alerts",
    tag: "alerts",
    summary: "Mark alerts read.",
    request: body({ all: { type: "boolean" }, ids: { type: "array", items: { type: "integer" } } }),
  },
  { method: "get", path: "/api/alerts/quiet", tag: "alerts", summary: "Quiet-hours config." },
  {
    method: "post",
    path: "/api/alerts/quiet",
    tag: "alerts",
    summary: "Update quiet-hours config.",
    request: body({ enabled: { type: "boolean" }, start: { type: "string" }, end: { type: "string" } }),
  },
  { method: "get", path: "/api/alerts/webhook", tag: "alerts", summary: "Outbound webhook config." },
  {
    method: "post",
    path: "/api/alerts/webhook",
    tag: "alerts",
    summary: "Update outbound webhook config.",
    request: body({ url: { type: "string" }, enabled: { type: "boolean" } }),
  },

  // Integrations (OTLP)
  { method: "get", path: "/api/otlp/summary", tag: "integrations", summary: "OTLP-derived per-session cost/tokens/latency." },
  {
    method: "post",
    path: "/api/otlp/v1/metrics",
    tag: "integrations",
    summary: "OTLP/HTTP metrics ingress (opt-in via MC_OTLP_ENABLED).",
    request: { required: true, content: { "application/json": { schema: jsonObject } } },
    responses: { "200": { description: "Accepted." }, "404": { description: "Disabled." } },
  },
  {
    method: "post",
    path: "/api/otlp/v1/logs",
    tag: "integrations",
    summary: "OTLP/HTTP logs ingress (opt-in via MC_OTLP_ENABLED).",
    request: { required: true, content: { "application/json": { schema: jsonObject } } },
    responses: { "200": { description: "Accepted." }, "404": { description: "Disabled." } },
  },

  // The ONLY write path for hook data.
  {
    method: "post",
    path: "/api/ingest",
    tag: "ingest",
    summary: "Ingest a Claude Code hook event. The only write path for hook data.",
    inline: [
      { name: "X-Hook-Event", in: "header", description: "Hook event name.", schema: { type: "string" } },
      { name: "X-Hook-Token", in: "header", description: "Shared secret (required iff MC_HOOK_TOKEN is set).", schema: { type: "string" } },
    ],
    request: {
      required: true,
      content: { "application/json": { schema: { $ref: "#/components/schemas/HookPayload" } } },
    },
    responses: {
      "200": { description: "Accepted (or skipped when no session_id).", content: { "application/json": { schema: jsonObject } } },
      "400": { description: "Invalid JSON or malformed payload." },
      "401": { description: "Bad X-Hook-Token." },
      "413": { description: "Payload too large." },
    },
  },
];

function body(properties: Record<string, unknown>): Record<string, unknown> {
  return { required: true, content: { "application/json": { schema: { type: "object", properties } } } };
}

export function buildOpenApiSpec(version = process.env.npm_package_version ?? "0.1.0"): Record<string, unknown> {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const r of ROUTES) {
    const parameters = [
      ...(r.params ?? []).map((p) => ({ $ref: `#/components/parameters/${cap(p)}` })),
      ...(r.inline ?? []),
    ];
    const op: Record<string, unknown> = {
      tags: [r.tag],
      summary: r.summary,
      responses: r.responses ?? ok("OK"),
    };
    if (parameters.length) op.parameters = parameters;
    if (r.request) op.requestBody = r.request;
    paths[r.path] = { ...(paths[r.path] ?? {}), [r.method]: op };
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "Claude Mission Control API",
      version,
      description:
        "Local, read-only observability API for Claude Code. Every path is read-only except POST /api/ingest (hook events) and the opt-in OTLP/config writers. The server binds to 127.0.0.1.",
      license: { name: "PolyForm Noncommercial 1.0.0", url: "https://polyformproject.org/licenses/noncommercial/1.0.0" },
    },
    servers: [{ url: "http://127.0.0.1:3000", description: "Local dashboard" }],
    tags: [
      "overview",
      "sessions",
      "economy",
      "activity",
      "tools",
      "quality",
      "alerts",
      "integrations",
      "system",
      "ingest",
    ].map((name) => ({ name })),
    components: {
      parameters: Object.fromEntries(Object.entries(PARAMS).map(([k, v]) => [cap(k), v])),
      schemas: {
        HookPayload: {
          type: "object",
          description: "Claude Code hook payload (extra fields are allowed).",
          properties: {
            session_id: { type: "string" },
            transcript_path: { type: "string" },
            cwd: { type: "string" },
            hook_event_name: { type: "string" },
            tool_name: { type: "string" },
            tool_input: { type: "object", additionalProperties: true },
            tool_response: {},
            prompt: { type: "string" },
            message: { type: "string" },
            source: { type: "string" },
            reason: { type: "string" },
            trigger: { type: "string" },
          },
        },
      },
    },
    paths,
  };
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
