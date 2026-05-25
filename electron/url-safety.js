// URL-safety policy for the Electron shell. Plain CommonJS so electron/main.js
// (which runs under Electron's Node and can't import the TypeScript app modules)
// can require it directly; a sibling url-safety.d.ts types it for the unit tests.

// Only these schemes may be handed to shell.openExternal, which can launch an OS
// handler. Everything else (file:, smb:, custom protocols, javascript:) is refused
// so a crafted link in rendered content can't trigger an arbitrary handler.
function isExternallyOpenable(url) {
  try {
    const scheme = new URL(url).protocol;
    return scheme === "http:" || scheme === "https:" || scheme === "mailto:";
  } catch {
    return false;
  }
}

// In-app navigation is only allowed within the local dashboard's own origin. A link
// to any other origin (or a non-http scheme) must be blocked from loading in the
// window — the caller opens it externally instead when it's safe to.
function isInternalNavigation(url, baseUrl) {
  try {
    return new URL(url).origin === new URL(baseUrl).origin;
  } catch {
    return false;
  }
}

module.exports = { isExternallyOpenable, isInternalNavigation };
