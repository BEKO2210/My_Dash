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

Desktop installers are currently **unsigned** (beta); verify downloads come from
the official [Releases](https://github.com/BEKO2210/My_Dash/releases) page.
