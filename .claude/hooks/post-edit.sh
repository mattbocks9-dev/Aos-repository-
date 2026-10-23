#!/bin/bash
# After every Edit/Write: format + lint the touched file, then typecheck the project.
# Exit 2 feeds the errors straight back to Claude so they get fixed in the same loop.
cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}"

file=$(jq -r '.tool_input.file_path // empty')
case "$file" in
  *.ts|*.tsx) ;;
  *) exit 0 ;;
esac
[ -f "$file" ] || exit 0
case "$file" in */node_modules/*|*/dist/*) exit 0 ;; esac

npx prettier --write "$file" >/dev/null 2>&1

if ! out=$(npx eslint "$file" 2>&1); then
  echo "eslint failed for $file:" >&2
  echo "$out" >&2
  exit 2
fi
if ! out=$(npx tsc -b --noEmit 2>&1); then
  echo "typecheck failed:" >&2
  echo "$out" | head -40 >&2
  exit 2
fi
exit 0
