#!/usr/bin/env bash
#
# "100% extension" as a check rather than a claim.
#
# On the integration branch, every core file that differs from upstream must be
# attributable to one of the framework or defect PRs listed below. Anything
# else is feature logic that has leaked back into the host, and it fails here
# on the commit that caused it rather than at handover.
#
# Usage:  assert-extension-only.sh [upstream-ref]        (default apache/master)
set -uo pipefail

UPSTREAM="${1:-apache/master}"

# Core paths that belong to a PR, with the PR that owns each. Keep this list
# short and argued: every entry is core code we are asking upstream to take.
#
# PR1  contribution points  — pages, view slots, the extension host
# PR2  deferred-write       — "accepted but not applied", host side
# PR3  defect              — a resync must not reset an editor's column flags
# PR4  defect              — show_chart_timestamps is a save-path default
ALLOWED=(
  "superset/change_management.py:PR2"
  "superset/extensions/:PR1"
  "superset/initialization/__init__.py:PR1"
  "superset/config.py:PR1"
  "superset/constants.py:PR1"
  "superset/mcp_service/:PR2"
  "superset-frontend/packages/superset-core/:PR1"
  "superset-frontend/src/core/:PR1"
  "superset-frontend/src/extensions/:PR1"
  "superset-frontend/src/pages/ExtensionPage/:PR1"
  "superset-frontend/src/views/routes.tsx:PR1"
  "superset-frontend/webpack.config.js:PR1"
  "superset/connectors/sqla/models.py:PR3"
  "superset/versioning/diff.py:PR4"
)

changed=$(git diff --name-only "$UPSTREAM"...HEAD -- superset/ superset-frontend/ || true)
[ -z "$changed" ] && { echo "clean: no core file differs from $UPSTREAM"; exit 0; }

leaked=()
while IFS= read -r file; do
  [ -z "$file" ] && continue
  ok=""
  for entry in "${ALLOWED[@]}"; do
    prefix="${entry%%:*}"
    case "$file" in "$prefix"*) ok="${entry##*:}"; break ;; esac
  done
  if [ -z "$ok" ]; then leaked+=("$file"); fi
done <<< "$changed"

total=$(printf '%s\n' "$changed" | grep -c . || true)
echo "core files differing from $UPSTREAM: $total"

if [ "${#leaked[@]}" -eq 0 ]; then
  echo "PASS: every one is attributable to a listed PR."
  exit 0
fi

echo
echo "FAIL: ${#leaked[@]} core file(s) belong to no PR. This is feature logic in the host:"
printf '  %s\n' "${leaked[@]}"
echo
echo "Either move it into local_extensions/asset-approval/, or add it to"
echo "ALLOWED with the PR that will carry it and the reason."
exit 1
