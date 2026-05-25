# Security Policy

## Supported versions

| Version | Supported |
|---------|-----------|
| 1.0.0-beta | ✅ |
| < 1.0.0 | ❌ |

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

Report privately via either:

- **GitHub** — *Security → Report a vulnerability* (private advisory) on this
  repository, or
- **Email** — **belkis.aslani@gmail.com**

Please include a description, reproduction steps, and the affected version/OS.
You can expect an acknowledgement within a few days and a fix or mitigation plan
once the report is triaged. Responsible disclosure is appreciated.

## Security posture

Claude Mission Control is **local-first and read-only** by design:

- The dashboard binds to `127.0.0.1` and stores data in a local SQLite file.
- Data flows one way — `Hooks → /api/ingest → SQLite → UI`; `/api/ingest` is the
  only write path, and the UI never writes to the database.
- The public demo (GitHub Pages) runs entirely in the browser with simulated
  data — it has no backend and collects nothing.

Optionally set `MC_HOOK_TOKEN` to require a shared secret (`X-Hook-Token`) on
`/api/ingest`, so only your wired hooks — not other local processes — can post
events.

### Verifying downloads

Desktop installers are currently **unsigned** (beta); always download them from
the official [Releases](https://github.com/BEKO2210/My_Dash/releases) page. Each
release also publishes a **`SHA256SUMS.txt`**; verify your download before running
it:

```sh
# from the folder containing the downloaded installer + SHA256SUMS.txt
sha256sum -c SHA256SUMS.txt          # Linux
shasum -a 256 -c SHA256SUMS.txt      # macOS
# Windows (PowerShell): compare the output of
#   Get-FileHash .\Claude-Mission-Control-Setup-<version>.exe -Algorithm SHA256
# against the matching line in SHA256SUMS.txt
```

### Content-Security-Policy (accepted risk)

The local server intentionally ships **no CSP**. The dashboard's 3D tool-call
graph and charts rely on inline styles, blob/WebGL workers and `data:` URLs, so a
strict policy would need careful per-feature nonce work for little gain: the server
binds to `127.0.0.1` only, serves no third-party or user-authored HTML, and takes
no ambient credentials. This is a **documented, accepted risk** for the local-only
tool rather than a silent omission; revisit if the dashboard is ever exposed beyond
loopback. (Conservative headers — `X-Content-Type-Options`, `X-Frame-Options:
DENY`, `Referrer-Policy: no-referrer`, `Permissions-Policy` — are still applied.)
