// Public-asset URL helper. On the static GitHub-Pages demo the app is served
// under a basePath (/My_Dash), so raw "/foo.png" would 404. Mirror next.config's
// basePath logic here so <img src> to files in /public resolves in both builds.
export const ASSET_BASE = process.env.NEXT_PUBLIC_MC_DEMO === "1" ? "/My_Dash" : "";

export function asset(path: string): string {
  return ASSET_BASE + (path.startsWith("/") ? path : "/" + path);
}
