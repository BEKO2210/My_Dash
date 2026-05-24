import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toCsv, toJson } from "@/lib/export-format";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Read-only data export. Whitelisted tables only, each with a sane row cap, newest
// first. `?table=<name>&format=json|csv` downloads one table; no table downloads a
// JSON bundle of all of them. Local-only, like every other read path.
const TABLES: Record<string, { sql: string; limit: number }> = {
  sessions: { sql: "SELECT * FROM sessions ORDER BY datetime(last_seen) DESC", limit: 5000 },
  events: { sql: "SELECT * FROM events ORDER BY id DESC", limit: 50000 },
  tool_calls: { sql: "SELECT * FROM tool_calls ORDER BY id DESC", limit: 50000 },
  prompts: { sql: "SELECT * FROM prompts ORDER BY id DESC", limit: 20000 },
  alerts: { sql: "SELECT * FROM alerts ORDER BY id DESC", limit: 10000 },
  alert_rules: { sql: "SELECT * FROM alert_rules ORDER BY id ASC", limit: 1000 },
  otlp_metric: { sql: "SELECT * FROM otlp_metric ORDER BY id DESC", limit: 50000 },
  otlp_log: { sql: "SELECT * FROM otlp_log ORDER BY id DESC", limit: 50000 },
};

function readTable(name: string): Record<string, unknown>[] {
  const def = TABLES[name];
  return db.prepare(`${def.sql} LIMIT ${def.limit}`).all() as Record<string, unknown>[];
}

function stamp(): string {
  return new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const table = url.searchParams.get("table");
    const format = url.searchParams.get("format") === "csv" ? "csv" : "json";

    if (!table) {
      // Full JSON bundle of every whitelisted table.
      const tables: Record<string, Record<string, unknown>[]> = {};
      for (const name of Object.keys(TABLES)) tables[name] = readTable(name);
      const bundle = toJson({ generatedAt: new Date().toISOString(), tables });
      return new Response(bundle, {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="mission-control-export-${stamp()}.json"`,
        },
      });
    }

    if (!(table in TABLES)) {
      return NextResponse.json({ error: "unknown table", tables: Object.keys(TABLES) }, { status: 400 });
    }

    const rows = readTable(table);
    if (format === "csv") {
      return new Response(toCsv(rows), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${table}-${stamp()}.csv"`,
        },
      });
    }
    return new Response(toJson(rows), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${table}-${stamp()}.json"`,
      },
    });
  } catch (err) {
    log.error("/api/export failed", err);
    return NextResponse.json({ error: "export failed" }, { status: 500 });
  }
}
