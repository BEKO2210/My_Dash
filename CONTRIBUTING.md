# Contributing to Claude Mission Control

Thanks for your interest in improving this project! It's a local, **read-only**
observability dashboard for Claude Code. Contributions of all sizes are welcome —
bug reports, docs, new widgets, or fixes.

## The one rule that shapes everything

Data flows **one way**:

```
Hooks → /api/ingest → SQLite → UI
```

`/api/ingest` is the **only** write path. Every widget and API route is
read-only — it reads from SQLite or receives data over SSE. The LLM never
renders this dashboard; it only *triggers* events. Please keep new code on the
right side of this boundary: no widget should ever write to the database.

## Getting started

```bash
cp .env.example .env     # optional: tweak port / EUR rate
npm install
npm run dev              # http://127.0.0.1:3000
npm run seed             # inject demo events to see the full UI immediately
```

To explore the UI without a running Claude session, the static demo engine
(`src/lib/demo.ts`) feeds the widgets with simulated events. Run the live demo
in your browser at https://beko2210.github.io/My_Dash/.

## Before you open a pull request

```bash
npm run lint     # ESLint (Next.js config)
npm test         # Vitest unit tests
npm run build    # production build (also type-checks)
```

Please make sure all three pass.

## Adding a widget (plugin)

The dashboard is a plugin grid. To add a panel:

1. Create `src/plugins/<your-plugin>/widget.tsx` exporting a React component
   (wrap your content in `<Panel title="…">`).
2. (Optional) add a **read-only** API route at `src/app/api/<your-plugin>/route.ts`.
3. Register it in `src/plugins/registry.ts`.

The grid renders it automatically.

After changing the registry, regenerate the widget catalogue so
`docs/PLUGINS.md` stays in sync (CI verifies it is up to date):

```bash
npm run docs:plugins     # regenerates docs/PLUGINS.md from src/plugins/registry.ts
```

## Desktop app (Electron) development

Besides the web dev server, the dashboard ships as a desktop app (tray icon +
background ingest server). To build and run the Electron shell locally:

```bash
npm run electron:dev     # packs the standalone build and launches Electron
```

Build double-click installers for your OS with `npm run dist` (or the targeted
`dist:win` / `dist:mac` / `dist:linux`). See the README for the per-OS first-run
notes on the unsigned beta installers.

## Conventions

- **TypeScript + React 19 + Next.js** with Tailwind CSS for styling.
- **Internationalisation**: user-facing strings live in `src/lib/i18n.tsx`
  (German and English). Add both when you introduce new copy.
- **Accessibility**: give icon-only controls an `aria-label`, keep dialogs
  closable with `Esc`, and prefer semantic elements.

## Reporting bugs

Open an issue describing what you did, what you expected, and what happened.
Screenshots or a copy of the relevant event payload help a lot. For security
issues, please follow the [Security Policy](SECURITY.md) instead of a public issue.

## Code of Conduct

This project follows a [Code of Conduct](CODE_OF_CONDUCT.md). By participating,
you are expected to uphold it.

By contributing you agree that your contributions are licensed under the
project's [license](LICENSE).
