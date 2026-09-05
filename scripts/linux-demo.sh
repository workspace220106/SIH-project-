#!/bin/bash
# Runs the build and checks on an offline machine.
# Usage: bash scripts/linux-demo.sh

set -eo pipefail
cd "$(dirname "$0")/.."

line() { echo; echo "--- $1 ---"; echo; }

line "system"
uname -srm
grep PRETTY_NAME /etc/os-release | cut -d'"' -f2
node -v

line "build"
npm run typecheck
npm run build | tail -5

line "offline check"
# grep exits 1 when it finds nothing, which here is the result we want
ext=$(grep -rl "fonts.googleapis\|cdn.jsdelivr\|unpkg.com\|cdnjs" dist/ 2>/dev/null | wc -l) || true
echo "external hosts referenced in dist: $ext"
echo "fonts bundled locally: $(find dist -name '*.woff2' | wc -l)"
[ "$ext" -eq 0 ] || { echo "FAIL: build references an external host"; exit 1; }

line "pipeline checks"
npm run verify

line "detection engine"
npm run inspect

line "done"
echo "serve with: npx serve dist -l 5173"
