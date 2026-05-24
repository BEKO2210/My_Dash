import { readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildOpenApiSpec } from "@/lib/openapi";

type Spec = ReturnType<typeof buildOpenApiSpec> & {
  openapi: string;
  info: Record<string, unknown>;
  paths: Record<string, Record<string, unknown>>;
  components: { schemas: Record<string, unknown>; parameters: Record<string, unknown> };
};

const spec = buildOpenApiSpec("9.9.9") as Spec;

// Discover the real route files so the spec can't silently drift from the code.
function discoverRoutes(dir: string, base = "/api"): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const seg = entry.name.replace(/^\[(.+)\]$/, "{$1}");
      out.push(...discoverRoutes(path.join(dir, entry.name), `${base}/${seg}`));
    } else if (entry.name === "route.ts") {
      out.push(base);
    }
  }
  return out;
}

describe("buildOpenApiSpec", () => {
  it("is a well-formed OpenAPI 3.1 document", () => {
    expect(spec.openapi).toBe("3.1.0");
    expect(spec.info.title).toBe("Claude Mission Control API");
    expect(spec.info.version).toBe("9.9.9");
    expect(spec.info.license).toMatchObject({ name: expect.stringContaining("PolyForm") });
    expect(Array.isArray(spec.servers)).toBe(true);
  });

  it("documents the single write path with the hook payload schema", () => {
    const ingest = spec.paths["/api/ingest"];
    expect(ingest.post).toBeTruthy();
    const post = ingest.post as Record<string, unknown>;
    expect(post.requestBody).toMatchObject({
      content: { "application/json": { schema: { $ref: "#/components/schemas/HookPayload" } } },
    });
    expect(spec.components.schemas.HookPayload).toBeTruthy();
  });

  it("models GET and POST on the same path, and resolves shared params", () => {
    expect(spec.paths["/api/alerts"].get).toBeTruthy();
    expect(spec.paths["/api/alerts"].post).toBeTruthy();
    expect(spec.components.parameters.Limit).toBeTruthy();
    const search = spec.paths["/api/search"].get as { parameters: unknown[] };
    expect(JSON.stringify(search.parameters)).toContain('"q"');
  });

  it("every operation has at least one response", () => {
    for (const [p, ops] of Object.entries(spec.paths)) {
      for (const [method, op] of Object.entries(ops)) {
        const responses = (op as { responses?: Record<string, unknown> }).responses;
        expect(Object.keys(responses ?? {}).length, `${method.toUpperCase()} ${p}`).toBeGreaterThan(0);
      }
    }
  });

  it("documents every real API route (no drift)", () => {
    const real = new Set(discoverRoutes(path.join(process.cwd(), "src/app/api")));
    real.delete("/api/openapi"); // self
    const documented = new Set(Object.keys(spec.paths));
    const missing = [...real].filter((p) => !documented.has(p));
    const extra = [...documented].filter((p) => !real.has(p));
    expect(missing, "undocumented routes").toEqual([]);
    expect(extra, "documented but nonexistent routes").toEqual([]);
  });
});
