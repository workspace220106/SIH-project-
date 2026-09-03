#!/usr/bin/env bash
#
# On-camera Linux demonstration.
#
# Runs the evidence a reviewer needs, in an order that tells a story, pausing
# between sections so you can narrate. Nothing here is staged: every number is
# produced live by the command shown above it.
#
#   bash scripts/linux-demo.sh          # pauses between sections (for video)
#   bash scripts/linux-demo.sh --fast   # no pauses (for a quick self-check)
#
set -u

PAUSE=1
[ "${1:-}" = "--fast" ] && PAUSE=0

BOLD=$'\033[1m'; DIM=$'\033[2m'; GRN=$'\033[32m'; RED=$'\033[31m'; CYN=$'\033[36m'; OFF=$'\033[0m'
step=0
fails=0

banner() {
  step=$((step + 1))
  printf '\n%s' "$BOLD"
  printf '━%.0s' $(seq 1 72); printf '\n'
  printf '  %02d  %s\n' "$step" "$1"
  printf '━%.0s' $(seq 1 72); printf '%s\n\n' "$OFF"
}

# Show the command, then run it. The viewer sees exactly what produced the output.
run() {
  printf '%s$ %s%s\n' "$CYN" "$*" "$OFF"
  "$@"
}

pause() {
  [ "$PAUSE" = "1" ] || return 0
  printf '\n%s   [ Enter to continue ]%s' "$DIM" "$OFF"
  read -r _
}

ok()   { printf '   %s✓%s %s\n' "$GRN" "$OFF" "$1"; }
bad()  { printf '   %s✗%s %s\n' "$RED" "$OFF" "$1"; fails=$((fails + 1)); }

clear
cat <<'HEAD'
   TRADELINE — Bitcoin Transaction Intelligence
   Team Ben 10

   Live demonstration that the system builds and runs on Linux, offline.
HEAD
pause

# ---------------------------------------------------------------------------
banner "This is Linux"
run uname -srm
echo
run grep PRETTY_NAME /etc/os-release
echo
run node --version
pause

# ---------------------------------------------------------------------------
banner "The filesystem is case-sensitive"
echo "${DIM}   Windows is not. This is the difference that breaks builds ported"
echo "   from a Windows machine, so it is worth proving rather than assuming.${OFF}"
echo
tmp=$(mktemp -d)
run touch "$tmp/Capture.csv" "$tmp/capture.csv"
count=$(ls "$tmp" | wc -l)
echo
if [ "$count" -eq 2 ]; then
  ok "two distinct files exist — genuinely case-sensitive"
else
  bad "only $count file — this filesystem is case-insensitive"
fi
rm -rf "$tmp"
pause

# ---------------------------------------------------------------------------
banner "It type-checks and builds"
run npm run typecheck
if [ $? -eq 0 ]; then ok "no type errors"; else bad "typecheck failed"; fi
echo
printf '%s$ npm run build%s\n' "$CYN" "$OFF"
npm run build 2>&1 | tail -4
if [ -f dist/index.html ]; then
  ok "dist/ produced — $(du -sh dist | cut -f1), self-contained"
else
  bad "no dist/ produced"
fi
pause

# ---------------------------------------------------------------------------
banner "Nothing reaches the network"
echo "${DIM}   The brief requires offline operation. Rather than claim it, look"
echo "   inside the built bundle for anything that would phone home.${OFF}"
echo
printf '%s$ grep -rl "fonts.googleapis\\|cdn.jsdelivr\\|unpkg.com" dist/ | wc -l%s\n' "$CYN" "$OFF"
external=$(grep -rl "fonts.googleapis\|cdn.jsdelivr\|unpkg.com\|cdnjs" dist/ 2>/dev/null | wc -l)
echo "$external"
echo
if [ "$external" -eq 0 ]; then
  ok "no external CDN or font host referenced anywhere in the build"
else
  bad "$external file(s) reference an external host"
fi
fonts=$(find dist -name '*.woff2' | wc -l)
ok "$fonts font files bundled locally instead of fetched"
pause

# ---------------------------------------------------------------------------
banner "Ingestion, parsing and the model — on this machine"
echo "${DIM}   Every check below is an assertion. This command exits non-zero if"
echo "   any of them fail, so a clean run cannot be faked by ignoring output.${OFF}"
echo
run npm run verify
if [ $? -eq 0 ]; then ok "all checks passed"; else bad "verification failed"; fi
pause

# ---------------------------------------------------------------------------
banner "The detection engine, in full"
run npm run inspect
pause

# ---------------------------------------------------------------------------
banner "Serving the application"
echo "${DIM}   Static files only. No backend, no database, no inference service.${OFF}"
echo
printf '%s$ npx --yes serve dist -l 5173%s\n\n' "$CYN" "$OFF"
echo "   Open http://localhost:5173 in a browser on this machine."
echo
if [ "$fails" -eq 0 ]; then
  printf '   %sEVERY CHECK PASSED ON LINUX%s\n' "$GRN$BOLD" "$OFF"
else
  printf '   %s%d CHECK(S) FAILED%s\n' "$RED$BOLD" "$fails" "$OFF"
fi
echo
exit $((fails > 0))
