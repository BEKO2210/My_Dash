# Claude Mission Control

A local, **read-only** observability dashboard for Claude Code. Live event stream,
session Kanban, token/cost charts and a 3D tool-call graph.

> **The golden rule:** data flows one way — `Hooks → /api/ingest → SQLite → UI`.
> The LLM never renders this dashboard; it only *triggers* events. The single write
> path is `/api/ingest`, fed exclusively by Claude Code hooks (machine events).

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

## Quick start

```bash
cp .env.example .env          # optional: tweak port / EUR rate
npm install
npm run dev                   # http://127.0.0.1:3000   (or ./start.sh for prod build)
npm run seed                  # inject demo events to see the full UI immediately
npm run install-hooks         # wire hooks into ~/.claude/settings.json (backs it up first)
npm run import-history        # optional: backfill past sessions from transcripts
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

## Config (`.env`)

| Var | Default | Meaning |
|-----|---------|---------|
| `MC_PORT` | `3000` | Port (bound to `127.0.0.1` only) |
| `EUR_PER_USD` | `0.92` | USD→EUR factor for cost display (ccusage reports USD) |
| `MC_HOOK_TOKEN` | _(empty)_ | Optional shared secret; if set, ingest requires it |
| `CLAUDE_DIR` | `~/.claude` | Where Claude Code stores transcripts/usage |
