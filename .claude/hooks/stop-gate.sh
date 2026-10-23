#!/bin/bash
# Before Claude finishes a turn, the unit tests must be green.
cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}"

input=$(cat)
# Avoid an infinite loop if we're already continuing because of this hook.
if [ "$(echo "$input" | jq -r '.stop_hook_active // false')" = "true" ]; then
  exit 0
fi
[ -d node_modules ] || exit 0

if ! out=$(npx vitest run --reporter=dot 2>&1); then
  echo "Unit tests are failing; fix them before finishing:" >&2
  echo "$out" | tail -60 >&2
  exit 2
fi
exit 0
