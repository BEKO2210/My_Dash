import type { NextConfig } from "next";

// Demo build: a fully static export for GitHub Pages (no server). The CI removes
// src/app/api before building so `output: export` succeeds; the demo serves all
// data from the in-browser engine (src/lib/demo.ts). MC_BASE_PATH defaults to the
// repo name for project Pages (https://USER.github.io/My_Dash/).
const isDemo = process.env.MC_DEMO === "1";
const basePath = isDemo ? process.env.MC_BASE_PATH ?? "/My_Dash" : undefined;

// Conservative, non-breaking security headers for the local server. (No CSP: the
// 3D graph/charts pull in inline styles, blob workers and WebGL, so a strict
// policy would need careful nonce work — out of scope for a 127.0.0.1-only tool.)
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = isDemo
  ? {
      output: "export",
      basePath,
      assetPrefix: basePath,
      trailingSlash: true,
      images: { unoptimized: true },
      env: { NEXT_PUBLIC_MC_DEMO: "1", NEXT_PUBLIC_MC_BASE_PATH: basePath ?? "" },
    }
  : {
      // Standalone output bundles a minimal server (.next/standalone/server.js) so the
      // Electron desktop build can ship it without the full node_modules tree.
      output: "standalone",
      // better-sqlite3 is a native module — keep it out of the bundle so it loads via require() at runtime.
      serverExternalPackages: ["better-sqlite3"],
      // Applied by the server (the static demo export ignores headers()).
      async headers() {
        return [{ source: "/:path*", headers: securityHeaders }];
      },
    };

export default nextConfig;
