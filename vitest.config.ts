import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    coverage: {
      // Gate the heavily unit-tested core logic (src/lib). UI (components/plugins/
      // app) is exercised by the Playwright e2e suite, not unit tests, so including
      // it here would only produce a misleadingly low number with a meaningless gate.
      provider: "v8",
      reporter: ["text-summary", "html"],
      include: ["src/lib/**/*.ts"],
      exclude: ["src/lib/**/*.test.ts", "src/lib/types.ts"],
      // Ratcheted just below the measured src/lib coverage (lines/statements ~83%,
      // functions ~88%, branches ~90%) with headroom for normal v8 variance. Raise
      // as coverage grows; never lower without a logged reason.
      thresholds: {
        lines: 78,
        statements: 78,
        functions: 80,
        branches: 85,
      },
    },
  },
});
