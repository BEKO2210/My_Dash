<p align="center">
  <img src="assets/Icon.png" alt="Claude Mission Control" width="360">
</p>

<p align="center">
  <img src="assets/logo.svg" alt="Claude Mission Control" width="520">
</p>

<p align="center">
  A local, <strong>read-only</strong> observability dashboard for Claude Code —
  live event stream, session Kanban, token/cost charts and a 3D tool-call graph.
</p>

<p align="center">
  <img alt="Status: alpha" src="https://img.shields.io/badge/status-alpha-f59e0b?style=flat-square">
  <img alt="Version 0.1.0" src="https://img.shields.io/badge/version-0.1.0-4f8cff?style=flat-square">
  <a href="https://github.com/BEKO2210/My_Dash/releases/latest"><img alt="Download" src="https://img.shields.io/badge/download-Win_·_macOS_·_Linux-4f8cff?style=flat-square&logo=github&logoColor=white"></a>
  <a href="https://beko2210.github.io/My_Dash/"><img alt="Live demo" src="https://img.shields.io/badge/live_demo-online-34d399?style=flat-square&logo=githubpages&logoColor=white"></a>
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-4f8cff?style=flat-square"></a>
  <a href="CONTRIBUTING.md"><img alt="PRs welcome" src="https://img.shields.io/badge/PRs-welcome-ff6b9d?style=flat-square"></a>
  <img alt="local-first" src="https://img.shields.io/badge/local--first-127.0.0.1-34d399?style=flat-square">
  <img alt="read-only" src="https://img.shields.io/badge/dashboard-read--only-4f8cff?style=flat-square">
</p>

<p align="center">
  <img alt="Next.js 16" src="https://img.shields.io/badge/Next.js-16-000?style=flat-square&logo=nextdotjs&logoColor=white">
  <img alt="React 19" src="https://img.shields.io/badge/React-19-149ECA?style=flat-square&logo=react&logoColor=white">
  <img alt="TypeScript 5" src="https://img.shields.io/badge/TypeScript-5-3178c6?style=flat-square&logo=typescript&logoColor=white">
  <img alt="Tailwind CSS 4" src="https://img.shields.io/badge/Tailwind_CSS-4-38BDF8?style=flat-square&logo=tailwindcss&logoColor=white">
  <img alt="Three.js" src="https://img.shields.io/badge/Three.js-r184-000?style=flat-square&logo=threedotjs&logoColor=white">
  <img alt="SQLite better-sqlite3" src="https://img.shields.io/badge/SQLite-better--sqlite3-003b57?style=flat-square&logo=sqlite&logoColor=white">
  <img alt="Tested with Vitest" src="https://img.shields.io/badge/tested_with-Vitest-6E9F18?style=flat-square&logo=vitest&logoColor=white">
</p>

<p align="center">
  <em>Alpha release (v0.1.0)</em> — local-first and usable today. The data contract
  (<code>Hooks → /api/ingest → SQLite → UI</code>) is stable; more widgets land via the plugin registry.
</p>

<p align="center">
  <img src="assets/demo.svg" alt="Claude Mission Control dashboard" width="100%">
</p>

---

## Demo

**▶ Live demo (runs entirely in your browser):** https://beko2210.github.io/My_Dash/

A static, client-only build (`src/lib/demo.ts`) simulates endless random Claude
tasks, so the full dashboard — live stream, kanban, token/cost charts and the 3D
graph — animates with no server. Deployed from `.github/workflows/pages.yml`
(enable repo → Settings → Pages → Source: **GitHub Actions**).

<!--
  Demo clips live in assets/ as looping GIFs (autoplay inline on GitHub) with the
  source MP4s linked underneath for full resolution. Regenerate a GIF from its MP4
  with ffmpeg if you re-record.
-->

### Dashboard

<p align="center">
  <img src="assets/dashboard.gif" alt="Claude Mission Control dashboard — live demo" width="100%">
</p>

▶️ [Full-resolution recording (dashboard.mp4)](https://github.com/BEKO2210/My_Dash/raw/main/assets/dashboard.mp4)

### 3D tool graph

<p align="center">
  <img src="assets/graph-3d.gif" alt="3D tool-call graph (fullscreen) — live demo" width="100%">
</p>

▶️ [Full-resolution recording (graph-3d.mp4)](https://github.com/BEKO2210/My_Dash/raw/main/assets/graph-3d.mp4)

---

## Features in action

The full dashboard — kanban, live stream, token/cost chart and the 3D tool-call graph
in one read-only view:

<p align="center">
  <img src="assets/feature-dashboard.png" alt="Claude Mission Control dashboard overview" width="100%">
</p>

**Global search** — filter the live stream and the session kanban straight from the header.

<p align="center">
  <img src="assets/feature-search.png" alt="Global search filtering the live stream and kanban" width="100%">
</p>

**Session details** — click any kanban card for its status, timings, counts and recent
events. Panels are drag-and-drop reorderable (with a one-click reset).

<p align="center">
  <img src="assets/feature-session-detail.png" alt="Session detail dialog with recent events" width="100%">
</p>

---

## Why

Most attempts at a "Claude dashboard" fail because they ask the LLM to *render* the
UI. That's the wrong mental model. Real dashboards (Grafana, Datadog) are
**read-only projections of an event log**.

> **The golden rule:** data flows one way — `Hooks → /api/ingest → SQLite → UI`.
> The LLM never renders this dashboard; it only *triggers* events. The single write
> path is `/api/ingest`, fed exclusively by Claude Code hooks (machine events).

## Features

- **Live stream** — every tool call, prompt and lifecycle event in real time (SSE).
- **Session Kanban** — sessions flow through `Aktiv → Wartet → Beendet`, filterable by project.
- **Tokens & cost** — daily usage via [`ccusage`](https://github.com/ryoppippi/ccusage), in USD **and** EUR.
- **3D tool-call graph** — Session → Tool → File, revealing structure across sessions.
- **Plugin-ready** — new panels drop in via a registry; the seam for future plugins.
- **Never in the way** — the hook forwarder is fire-and-forget and never blocks Claude.

## Architecture

```
Claude Code CLI (your machine)
  └─ hook fires (PreToolUse, PostToolUse, Stop, SessionStart/End, …)
       └─ scripts/claude-hook.sh   (stdin JSON → curl, --max-time 1, never blocks Claude)
            └─ POST 127.0.0.1:3000/api/ingest      ← the ONLY write path
                 ├─ writes events + updates sessions/tool_calls (better-sqlite3)
                 └─ broadcasts via in-memory bus
                      └─ GET /api/stream (SSE) → widgets update live

Side sources (read-only):
  ~/.claude/projects/**/*.jsonl → scripts/import-history.mjs  (backfill)
  npx ccusage --json            → /api/usage                 (tokens & cost)
```

One Next.js process. SQLite file at `./data/mission-control.db` (gitignored).

## Install (desktop app)

### ⬇️ [Download the latest release](https://github.com/BEKO2210/My_Dash/releases/latest)

Double-click installers for **Windows, macOS and Linux** are built by the release
workflow and attached to every [GitHub Release](https://github.com/BEKO2210/My_Dash/releases):

| OS | File ([latest](https://github.com/BEKO2210/My_Dash/releases/latest)) |
|----|------|
| Windows | `Claude Mission Control Setup <version>.exe` (NSIS installer) |
| macOS | `Claude Mission Control-<version>.dmg` |
| Linux | `.AppImage` (portable) or `.deb` |

> **Alpha note:** the installers are **unsigned**. On Windows, SmartScreen shows
> *More info → Run anyway*; on macOS, right-click the app → **Open** the first time.

The app bundles its own Node runtime (nothing to install separately). It runs in the
background with a tray icon — click the tray → **Connect Claude Code (install hooks)**,
then restart any open Claude Code session and activity appears live. It can auto-start at
login and keeps the ingest server running when the window is closed. The local database
lives in your OS user-data folder.

### Build the installers yourself

```bash
npm install
npm run dist          # installer for your current OS → dist/
npm run dist:win      # or target a specific OS (build each on that OS, e.g. via CI)
npm run dist:mac
npm run dist:linux
```

CI (`.github/workflows/release.yml`) builds all three on a tag push (`v*`).

## Quick start (from source)

**One click (Linux):**

```bash
./install.sh                  # installs deps, wires hooks, builds, starts, opens the browser
```

It also drops a **“Claude Mission Control” launcher on your Desktop** — double-click it to start anytime.

**Manual:**

```bash
cp .env.example .env          # optional: tweak port / EUR rate
npm install
npm run dev                   # http://127.0.0.1:3000   (or ./start.sh for a prod build)
npm run seed                  # inject demo events to see the full UI immediately
npm run install-hooks         # wire hooks into ~/.claude/settings.json (backs it up first)
npm run import-history        # optional: backfill past sessions from transcripts
npm test                      # optional: run the unit tests (Vitest)
```

Restart any running Claude Code session after `install-hooks`, then watch it appear live.

## Adding a plugin (widget)

The dashboard is a plugin grid. To add a panel:

1. Create `src/plugins/<your-plugin>/widget.tsx` exporting a React component
   (wrap your content in `<Panel title="…">`).
2. (Optional) add a read-only API route at `src/app/api/<your-plugin>/route.ts`.
3. Register it in `src/plugins/registry.ts`.

That's it — the grid renders it automatically. This is the seam reserved for the
future Obsidian knowledge-graph / semantic-search plugins.

## Configuration (`.env`)

| Var | Default | Meaning |
|-----|---------|---------|
| `MC_PORT` | `3000` | Port (bound to `127.0.0.1` only) |
| `EUR_PER_USD` | `0.92` | USD→EUR factor for cost display (ccusage reports USD) |
| `MC_HOOK_TOKEN` | _(empty)_ | Optional shared secret; if set, ingest requires it |
| `CLAUDE_DIR` | `~/.claude` | Where Claude Code stores transcripts/usage |

## Project layout

```
src/
├─ app/                 # Next.js routes + API (the read paths + the single /api/ingest write path)
│  ├─ api/{ingest,stream,sessions,events,graph,usage}/route.ts
│  └─ icon.svg          # favicon (auto-picked up by Next)
├─ lib/                 # db, event bus, ingest projection, ccusage, formatting
├─ plugins/             # ◀ widgets: live-stream, kanban, token-chart, tool-graph + registry.ts
└─ components/          # dashboard shell, live SSE provider, search, panel
scripts/                # claude-hook.sh, install-hooks, import-history, seed-demo, packaging
electron/               # desktop shell (main process + build icon) — packaged via electron-builder
assets/                 # logo, icon, demo clips (gif/mp4) + screenshots
```

## Tests

```bash
npm test         # unit tests (Vitest)
npm run lint     # ESLint (Next.js config)
npm run build    # production build (also type-checks)
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). In short: keep the one-way data flow
(`Hooks → /api/ingest → SQLite → UI`) intact, and run `npm test` + `npm run lint`
before opening a pull request.

## License

[MIT](LICENSE) © Belkis Aslani

---

<p align="center"><sub>read-only · Hooks → SQLite → UI · the AI never renders this dashboard</sub></p>
