# Claude Mission Control — agent guide

A local, **read-only** observability dashboard for Claude Code (Next.js 16 ·
React 19 · TypeScript · Tailwind · SQLite · Three.js). Public beta: `v1.0.0-beta`.

## The one rule that shapes everything
Data flows **one way**: `Hooks → /api/ingest → SQLite → UI`. `/api/ingest` is the
**only** write path. Widgets and API reads are read-only; the UI never writes to
the DB. Keep every change on the right side of this boundary.

## Commands
- `npm run dev` — dev server (http://127.0.0.1:3000)
- `npm run seed` — inject demo events to populate the UI
- `npm run lint` · `npm test` · `npm run build` — must all pass before a PR
- `npm run test:e2e` — Playwright e2e suite

## Conventions
- User-facing strings live in `src/lib/i18n.tsx` — add **both** DE and EN.
- Icon-only controls need `aria-label`; dialogs close on `Esc`; keep things accessible.
- Widgets are plugins under `src/plugins/<id>/` registered in `src/plugins/registry.ts`.

## 🧭 Team mode (multi-agent)
This repo can be worked by a **4-agent team** (Atlas · Forge · Prism · Sentinel)
that coordinates through the shared **`.team/`** folder.

**If the user assigns you a team role** (e.g. "You are Forge"):
1. Read **`.team/README.md`** (the protocol) and **`.team/roles/<your-name>.md`** first.
2. Follow the protocol strictly — log to `.team/log.md`, respect `.team/sync.md`
   gates, claim work via `.team/locks/`, edit **only your domain's files**, and
   serialize commits with `.team/locks/git.lock`. **Only Atlas pushes / opens PRs.**

If no role is assigned, work normally as a single assistant (ignore team mode).
