import type { NextConfig } from "next";

// Demo build: a fully static export for GitHub Pages (no server). The CI removes
// src/app/api before building so `output: export` succeeds; the demo serves all
// data from the in-browser engine (src/lib/demo.ts). MC_BASE_PATH defaults to the
// repo name for project Pages (https://USER.github.io/My_Dash/).
const isDemo = process.env.MC_DEMO === "1";
const basePath = isDemo ? process.env.MC_BASE_PATH ?? "/My_Dash" : undefined;

const nextConfig: NextConfig = isDemo
  ? {
      output: "export",
      basePath,
      assetPrefix: basePath,
      trailingSlash: true,
      images: { unoptimized: true },
      env: { NEXT_PUBLIC_MC_DEMO: "1" },
    }
  : {
      // better-sqlite3 is a native module — keep it out of the bundle so it loads via require() at runtime.
      serverExternalPackages: ["better-sqlite3"],
    };

export default nextConfig;
