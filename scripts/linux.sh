#!/bin/bash
# Runs the build and checks on an offline machine.
# Usage: bash scripts/linux.sh

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

line "geoip"
db=public/geoip/ipv4-country.json
if [ -f "$db" ]; then
  ranges=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$db','utf8')).ranges.length)")
  echo "local table: $ranges ranges"
else
  echo "local table: not present"
  ranges=0
fi
[ "$ranges" -gt 0 ] || echo "not installed, so country and ASN come from the capture (npm run geoip to add it)"
col=public/samples/capture-sample.csv
echo -n "countries in the sample capture: "
awk -F, 'NR==1{for(i=1;i<=NF;i++) if($i=="geo_country") c=i; next} c && $c!="" {print $c}' "$col" | sort -u | tr '\n' ' '
echo

line "pipeline checks"
npm run verify

line "detection engine"
npm run inspect

line "done"
echo "serve with: npx serve dist -l 5173"
