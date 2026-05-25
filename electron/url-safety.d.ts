// Types for the CommonJS url-safety module so the unit tests (and any TS consumer)
// get full typing while electron/main.js requires the .js at runtime.
export function isExternallyOpenable(url: string): boolean;
export function isInternalNavigation(url: string, baseUrl: string): boolean;
