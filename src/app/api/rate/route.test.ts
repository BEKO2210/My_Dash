import { afterEach, describe, expect, it } from "vitest";

// The rate route serves the SERVER EUR_PER_USD (ccusage's source) so the client
// can't diverge from server-computed costEur. eurRate reads env at call time.
describe("/api/rate", () => {
  const ENV = { ...process.env };
  afterEach(() => {
    process.env = { ...ENV };
  });

  it("serves the server EUR_PER_USD, defaulting to 0.92", async () => {
    const { GET } = await import("@/app/api/rate/route");

    delete process.env.EUR_PER_USD;
    expect((await (await GET()).json()).eurPerUsd).toBe(0.92);

    process.env.EUR_PER_USD = "0.9";
    expect((await (await GET()).json()).eurPerUsd).toBe(0.9);

    process.env.EUR_PER_USD = "garbage";
    expect((await (await GET()).json()).eurPerUsd).toBe(0.92); // bad → default
  });
});
