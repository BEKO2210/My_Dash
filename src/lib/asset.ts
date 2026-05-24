// Public-asset URL helper. On the static GitHub-Pages demo the app is served
// under a basePath (e.g. /My_Dash), so raw "/foo.png" would 404. next.config
// exposes the active basePath as NEXT_PUBLIC_MC_BASE_PATH; use it so <img src>
// to files in /public resolves under any basePath (and is "" in the normal build).
export const ASSET_BASE = process.env.NEXT_PUBLIC_MC_BASE_PATH ?? "";

export function asset(path: string): string {
  return ASSET_BASE + (path.startsWith("/") ? path : "/" + path);
}
