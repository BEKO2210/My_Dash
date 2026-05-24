# Data export & schema

Claude Mission Control keeps everything in one local SQLite database
(`data/mission-control.db`). All export paths are **read-only** and local-only.

## Ways to export

| Method | What you get |
| --- | --- |
| **Command palette** (`⌘/Ctrl-K` → "Export…") | Downloads via the browser: full JSON bundle, or `sessions` / `events` as CSV. |
| **`GET /api/export`** | JSON bundle of every whitelisted table (file download). |
| **`GET /api/export?table=<name>&format=json\|csv`** | One table as JSON or CSV (file download). |
| **`npm run export-log`** | A Markdown transcript **and** a structured `log-<stamp>.json` (sessions with their events) under `exports/`. |

`format` defaults to `json`. Unknown tables return `400` with the list of valid
names. CSV follows RFC 4180 (quotes doubled; fields containing `,` `"` CR or LF are
quoted); object/array cells are embedded as JSON.

## Exportable tables

The `/api/export` whitelist (each newest-first, row-capped):

`sessions`, `events`, `tool_calls`, `prompts`, `alerts`, `alert_rules`,
`otlp_metric`, `otlp_log`.

## Schema (key columns)

The full, authoritative schema is the append-only migration list in
`src/lib/migrations-sql.mjs`. Summary of the main tables:

### `sessions`
One row per Claude Code session.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | TEXT (PK) | Session UUID. |
| `project_path`, `project_name` | TEXT | Working directory + derived name. |
| `title` | TEXT | Derived from the first prompt. |
| `status` | TEXT | `active` \| `waiting` \| `ended`. |
| `source` | TEXT | SessionStart source. |
| `first_seen`, `last_seen`, `ended_at` | DATETIME | Lifecycle timestamps (UTC). |
| `token_input`, `token_output`, `token_cache` | INTEGER | Per-session token totals. |
| `cost_usd` | REAL | Estimated session cost. |
| `branch`, `git_commit`, `remote_url` | TEXT | Git context (read at SessionStart). |
| `transcript_path` | TEXT | Path to the JSONL transcript. |
| `machine` | TEXT | NULL = local; a label marks rows synced from another machine. |

### `events`
Append-only stream of hook events.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | INTEGER (PK) | Autoincrement. |
| `session_id` | TEXT | FK → `sessions.id`. |
| `event_type` | TEXT | Hook event name. |
| `tool_name` | TEXT | When applicable. |
| `summary` | TEXT | Human-readable one-liner. |
| `payload_json` | TEXT | Raw (sanitized) hook payload. |
| `created_at` | DATETIME | UTC. |

### `tool_calls`
One row per tool invocation.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | INTEGER (PK) | Autoincrement. |
| `session_id` | TEXT | FK → `sessions.id`. |
| `tool_name` | TEXT | |
| `target` | TEXT | What the tool acted on (file/command/…). |
| `duration_ms` | INTEGER | |
| `success` | INTEGER | `1`/`0`. |
| `created_at` | DATETIME | UTC. |

### `prompts`
Redacted user prompts. Columns: `id`, `session_id`, `text`, `created_at`.

### `alerts` / `alert_rules`
In-app alerting. `alert_rules`: `id`, `type`, `threshold`, `enabled`, `label`.
`alerts`: `id`, `rule_id`, `type`, `message`, `session_id`, `dedup_key`, `read`,
`created_at`.

### `otlp_metric` / `otlp_log`
Rows from the optional OTLP receiver. Common columns: `id`, `received_at`, `ts`,
`name`, `session_id`, `model`, plus `value` (metrics) or `body` (logs) and an
`attrs` JSON blob.
