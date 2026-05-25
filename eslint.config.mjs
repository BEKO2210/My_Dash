import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // The Electron main process is CommonJS (loaded by Electron's Node runtime).
  {
    files: ["electron/**/*.js"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // electron-builder output (packaged app + unpacked runtime).
    "dist/**",
    // v8 coverage HTML report (generated; ships its own vendored JS).
    "coverage/**",
  ]),
]);

export default eslintConfig;
