#!/usr/bin/env bash
# Universal Claude Code hook forwarder.
# Usage (from settings.json):  bash /path/to/claude-hook.sh <EventName>
#
# Reads the hook's JSON payload from stdin and forwards it to the dashboard.
# Fire-and-forget by design: short timeout, errors swallowed, ALWAYS exits 0 —
# a stopped or slow dashboard must never block or slow down Claude Code.

payload=$(cat)
curl -s --max-time 1 \
  -X POST "http://127.0.0.1:${MC_PORT:-3000}/api/ingest" \
  -H 'Content-Type: application/json' \
  -H "X-Hook-Event: ${1:-unknown}" \
  ${MC_HOOK_TOKEN:+-H "X-Hook-Token: ${MC_HOOK_TOKEN}"} \
  --data-binary "$payload" >/dev/null 2>&1 || true

exit 0
