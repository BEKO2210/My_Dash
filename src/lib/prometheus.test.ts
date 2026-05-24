import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { collectMetrics, renderPrometheus, type PromMetric } from "@/lib/prometheus";
import { migrate } from "@/lib/migrations";

let open: Database.Database | null = null;
afterEach(() => {
  open?.close();
  open = null;
});

describe("renderPrometheus", () => {
  it("emits HELP/TYPE headers, labels, and a trailing newline", () => {
    const metrics: PromMetric[] = [
      { name: "mc_up", help: "up", type: "gauge", samples: [{ value: 1 }] },
      {
        name: "mc_sessions",
        help: "by status",
        type: "gauge",
        samples: [
          { value: 2, labels: { status: "active" } },
          { value: 0, labels: { status: "ended" } },
        ],
      },
    ];
    const out = renderPrometheus(metrics);
    expect(out).toBe(
      [
        "# HELP mc_up up",
        "# TYPE mc_up gauge",
        "mc_up 1",
        "# HELP mc_sessions by status",
        "# TYPE mc_sessions gauge",
        'mc_sessions{status="active"} 2',
        'mc_sessions{status="ended"} 0',
        "",
      ].join("\n"),
    );
  });

  it("escapes backslashes, quotes, and newlines in help text and label values", () => {
    const out = renderPrometheus([
      {
        name: "mc_info",
        help: 'line\nbreak \\ end',
        type: "gauge",
        samples: [{ value: 1, labels: { path: 'C:\\a"b' } }],
      },
    ]);
    expect(out).toContain("# HELP mc_info line\\nbreak \\\\ end");
    expect(out).toContain('mc_info{path="C:\\\\a\\"b"} 1');
  });

  it("formats non-finite values per the spec", () => {
    const out = renderPrometheus([
      { name: "mc_x", help: "x", type: "gauge", samples: [{ value: Infinity }, { value: -Infinity }, { value: NaN }] },
    ]);
    expect(out).toContain("mc_x +Inf");
    expect(out).toContain("mc_x -Inf");
    expect(out).toContain("mc_x NaN");
  });
});

describe("collectMetrics", () => {
  it("reads aggregates from the database", () => {
    const db = (open = new Database(":memory:"));
    migrate(db);
    db.prepare(
      `INSERT INTO sessions (id, status, cost_usd, token_input, token_output, token_cache) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run("s1", "active", 1.5, 1000, 200, 50);
    db.prepare(
      `INSERT INTO sessions (id, status, cost_usd, token_input, token_output, token_cache) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run("s2", "ended", 0.5, 10, 20, 0);
    db.prepare(`INSERT INTO tool_calls (session_id, tool_name, success) VALUES ('s1', 'Read', 1)`).run();
    db.prepare(`INSERT INTO tool_calls (session_id, tool_name, success) VALUES ('s1', 'Bash', 0)`).run();

    const byName = new Map(collectMetrics(db).map((m) => [m.name, m]));

    const sessions = byName.get("mc_sessions")!;
    expect(sessions.samples.find((s) => s.labels?.status === "active")?.value).toBe(1);
    expect(sessions.samples.find((s) => s.labels?.status === "ended")?.value).toBe(1);
    expect(sessions.samples.find((s) => s.labels?.status === "waiting")?.value).toBe(0); // default kept

    expect(byName.get("mc_cost_usd")!.samples[0].value).toBeCloseTo(2.0);
    expect(byName.get("mc_tool_calls_total")!.samples[0].value).toBe(2);
    expect(byName.get("mc_tool_call_errors_total")!.samples[0].value).toBe(1);

    const tokens = byName.get("mc_tokens")!;
    expect(tokens.samples.find((s) => s.labels?.type === "input")?.value).toBe(1010);
    expect(tokens.samples.find((s) => s.labels?.type === "cache")?.value).toBe(50);

    // Renders cleanly end to end.
    expect(renderPrometheus(collectMetrics(db))).toContain("# TYPE mc_up gauge");
  });
});
