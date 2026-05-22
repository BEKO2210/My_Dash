#!/usr/bin/env bash
# One command to run Claude Mission Control locally (binds to 127.0.0.1 only).
set -euo pipefail
cd "$(dirname "$0")"

# Load local config if present.
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

PORT="${MC_PORT:-3000}"

if [ ! -d node_modules ]; then
  echo "› Installing dependencies…"
  npm install
fi

echo "› Building…"
npm run build

echo "› Claude Mission Control → http://127.0.0.1:${PORT}"
PORT="$PORT" npm run start
