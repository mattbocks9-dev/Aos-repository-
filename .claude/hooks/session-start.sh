#!/bin/bash
# Install dependencies at session start so hooks, tests and lint can run.
set -euo pipefail
cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}"

stamp="node_modules/.lock-hash"
hash=$(sha1sum package-lock.json | cut -d' ' -f1)
if [ -d node_modules ] && [ -f "$stamp" ] && [ "$(cat "$stamp")" = "$hash" ]; then
  exit 0
fi
npm ci --no-audit --no-fund >/dev/null 2>&1 || npm install --no-audit --no-fund >/dev/null
echo "$hash" > "$stamp"
