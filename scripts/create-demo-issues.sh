#!/usr/bin/env bash
# Create GitHub issues for seeded demo bugs (no devin-remediate label).
# Usage:
#   ./scripts/create-demo-issues.sh
#   GITHUB_REPO=AFadhluddin/superset ./scripts/create-demo-issues.sh
set -euo pipefail

TARGET_BRANCH="devin-demo-target-v2"
GITHUB_REPO="${GITHUB_REPO:-AFadhluddin/superset}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$REPO_ROOT"

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI (gh) is required. Install: https://cli.github.com/"
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "gh is not authenticated. Run: gh auth login"
  exit 1
fi

filter_labels() {
  local requested="$1"
  local available
  available="$(gh label list --repo "$GITHUB_REPO" --limit 200 --json name -q '.[].name' 2>/dev/null || true)"
  local result=()
  local label
  IFS=',' read -r -a labels <<< "$requested"
  for label in "${labels[@]}"; do
    label="$(echo "$label" | xargs)"
    if echo "$available" | grep -Fxq "$label"; then
      result+=("$label")
    else
      echo "  skipping missing label: ${label}" >&2
    fi
  done
  (IFS=','; echo "${result[*]}")
}

create_issue() {
  local title="$1"
  local labels="$2"
  local body="$3"

  local filtered
  filtered="$(filter_labels "$labels")"

  local args=(issue create --repo "$GITHUB_REPO" --title "$title" --body "$body")
  if [[ -n "$filtered" ]]; then
    args+=(--label "$filtered")
  fi

  echo ""
  echo "Creating: $title"
  if [[ -n "$filtered" ]]; then
    echo "  labels: $filtered"
  else
    echo "  labels: (none applied)"
  fi

  local url
  url="$(gh "${args[@]}")"
  local number
  number="${url##*/}"

  gh issue comment "$number" --repo "$GITHUB_REPO" \
    --body "Target branch for remediation: ${TARGET_BRANCH}"

  echo "  created: $url"
}

COMMON_FOOTER="
## Target branch
\`${TARGET_BRANCH}\`

## Notes for remediation
- Do not add the \`devin-remediate\` label until the demo operator triggers automation manually.
- Add focused regression tests as part of the fix.
"

# ---------------------------------------------------------------------------
# Issue 1
# ---------------------------------------------------------------------------
create_issue \
  "Frontend: dashboard filter formatter should preserve numeric zero values" \
  "bug,frontend,dashboard,demo-seed,test-needed" \
  "## Summary
Dashboard filter indicators and badges show a blank value when a native filter is set to numeric \`0\`.

## Expected behavior
- \`0\` displays as \`\"0\"\`
- \`null\`, \`undefined\`, and \`\"\"\` remain empty/missing

## Actual behavior
Numeric \`0\` is treated as missing and renders as an empty string.

## Affected area
- \`superset-frontend/src/dashboard/components/nativeFilters/utils.ts\` — \`getFilterValueForDisplay()\`

## Acceptance criteria
- [ ] \`getFilterValueForDisplay(0)\` returns \`\"0\"\`
- [ ] \`getFilterValueForDisplay(null)\`, \`undefined\`, and \`\"\"\` still return \`\"\"\`
- [ ] Dashboard filter badge shows \`0\` for a zero-valued numeric filter
- [ ] Unit test added for numeric zero
${COMMON_FOOTER}"

# ---------------------------------------------------------------------------
# Issue 2
# ---------------------------------------------------------------------------
create_issue \
  "Frontend: dashboard filter formatter should preserve boolean false values" \
  "bug,frontend,dashboard,demo-seed,test-needed" \
  "## Summary
Dashboard filter display treats boolean \`false\` as an empty/missing value.

## Expected behavior
- \`false\` displays as \`\"false\"\`
- \`true\` displays as \`\"true\"\`
- \`null\` and \`undefined\` remain empty/missing

## Actual behavior
Boolean \`false\` renders as an empty string in filter badges and tooltips.

## Affected area
- \`superset-frontend/src/dashboard/components/nativeFilters/utils.ts\` — \`getFilterValueForDisplay()\`

## Acceptance criteria
- [ ] \`getFilterValueForDisplay(false)\` returns \`\"false\"\`
- [ ] \`getFilterValueForDisplay(true)\` returns \`\"true\"\`
- [ ] Dashboard UI shows \`false\` when a boolean filter is set to false
- [ ] Unit test added for boolean false/true
${COMMON_FOOTER}"

# ---------------------------------------------------------------------------
# Issue 3
# ---------------------------------------------------------------------------
create_issue \
  "Backend: normalize empty string bounds in colon-separated time range parsing" \
  "bug,backend,demo-seed,test-needed" \
  "## Summary
Open-ended time ranges with an empty bound (e.g. \`\"start of this month : \"\`) fail because empty strings are not normalized to \`None\`.

## Expected behavior
- \`\"start of this month : \"\` → \`(since_datetime, None)\`
- \`\" : now\"\` → \`(None, until_datetime)\`
- Closed ranges continue to parse correctly

## Actual behavior
Empty string bounds are passed to datetime parsing instead of being treated as missing.

## Affected area
- \`superset/utils/date_parser.py\` — \`get_since_until()\`, colon-separated partition loop

## Acceptance criteria
- [ ] Empty bound segments normalize to \`None\`
- [ ] \`get_since_until(\"start of this month : \")\` returns \`None\` for the open bound
- [ ] Existing \`test_get_since_until\` passes
- [ ] Unit test added for empty-string bound normalization
${COMMON_FOOTER}"

# ---------------------------------------------------------------------------
# Issue 4
# ---------------------------------------------------------------------------
create_issue \
  "Backend: trim whitespace before treating time range bounds as empty" \
  "bug,backend,demo-seed,test-needed" \
  "## Summary
Whitespace-only time range bounds (e.g. \`\"start of this month :   \"\`) are not trimmed before the empty-bound check.

## Expected behavior
Bounds containing only whitespace should be treated the same as an empty/missing bound.

## Actual behavior
Whitespace-only segments are treated as non-empty and sent through datetime expression parsing.

## Affected area
- \`superset/utils/date_parser.py\` — \`get_since_until()\`, \`since_and_until_partition\`

## Acceptance criteria
- [ ] Partition segments are stripped before empty-bound normalization
- [ ] \`\"start of this month :   \"\` behaves like an open-ended until bound
- [ ] Valid non-empty bounds with intentional internal spaces still parse correctly
- [ ] Unit test added for whitespace-only bounds
${COMMON_FOOTER}"

# ---------------------------------------------------------------------------
# Issue 5
# ---------------------------------------------------------------------------
create_issue \
  "Backend: treat empty until parameter as missing in get_since_until" \
  "bug,backend,demo-seed,test-needed" \
  "## Summary
When \`until=\"\"\` is passed directly to \`get_since_until()\`, the empty string is parsed instead of falling back to the relative end default.

## Expected behavior
- \`until=\"\"\` should behave like a missing until value
- Valid until strings continue to parse correctly

## Actual behavior
\`until=\"\"\` triggers \`parse_human_datetime(\"\")\` instead of using the default relative end.

## Affected area
- \`superset/utils/date_parser.py\` — \`get_since_until()\` else branch

## Acceptance criteria
- [ ] \`get_since_until(since=\"7 days ago\", until=\"\")\` treats until as missing
- [ ] Non-empty until values still parse correctly
- [ ] Unit test added for empty-string \`until\` parameter
${COMMON_FOOTER}"

# ---------------------------------------------------------------------------
# Issue 6
# ---------------------------------------------------------------------------
create_issue \
  "Backend: parse_boolean_string should accept common boolean strings with surrounding whitespace" \
  "bug,backend,demo-seed,test-needed" \
  "## Summary
\`parse_boolean_string()\` returns incorrect results for common boolean strings that include surrounding whitespace.

## Expected behavior
- \`\" true \"\` → \`True\`
- \`\" false \"\` → \`False\`
- \`None\` and \`\"\"\` → \`False\`

## Actual behavior
Whitespace-padded values such as \`\" true \"\` are not recognized and fall through to \`False\`.

## Affected area
- \`superset/utils/core.py\` — \`parse_boolean_string()\`

## Acceptance criteria
- [ ] Leading/trailing whitespace is handled consistently
- [ ] Case-insensitive true/false values continue to work
- [ ] Unit tests added for whitespace-padded boolean strings
${COMMON_FOOTER}"

# ---------------------------------------------------------------------------
# Issue 7
# ---------------------------------------------------------------------------
create_issue \
  "Backend: ignore empty Rison filter query parameter instead of parsing" \
  "bug,backend,demo-seed,test-needed" \
  "## Summary
An empty \`f\` Rison filter query parameter should be treated as \"no filters\", but it is passed to the parser.

## Expected behavior
- \`filter_string=\"\"\` → \`[]\`
- \`filter_string=None\` → \`[]\`
- Valid Rison strings continue to parse

## Actual behavior
Empty string input is not treated as a no-op and may produce warnings or incorrect filter objects.

## Affected area
- \`superset/utils/rison_filters.py\` — \`RisonFilterParser.parse()\`

## Acceptance criteria
- [ ] \`\"\"\` returns an empty filter list
- [ ] Valid Rison filter strings still parse correctly
- [ ] Unit test added for empty-string \`f\` parameter
${COMMON_FOOTER}"

# ---------------------------------------------------------------------------
# Issue 8
# ---------------------------------------------------------------------------
create_issue \
  "Frontend: dashboard customizations badge should count zero as an active value" \
  "bug,frontend,dashboard,demo-seed,test-needed" \
  "## Summary
The dashboard customizations badge hides active display controls when the selected value is numeric \`0\` or boolean \`false\`.

## Expected behavior
- \`0\` and \`false\` count as active customization values
- Only \`null\` / \`undefined\` should be excluded

## Actual behavior
The badge count and tooltip omit customizations whose value is \`0\` or \`false\`.

## Affected area
- \`superset-frontend/src/dashboard/components/CustomizationsBadge/index.tsx\` — \`effectiveCustomizations\`

## Acceptance criteria
- [ ] Customizations with value \`0\` appear in the badge count
- [ ] Customizations with value \`false\` appear in the badge count
- [ ] \`null\` / \`undefined\` values are still excluded
- [ ] Unit test added for falsy-but-valid customization values
${COMMON_FOOTER}"

# ---------------------------------------------------------------------------
# Issue 9
# ---------------------------------------------------------------------------
create_issue \
  "Frontend: native filter extractLabel should preserve zero in multi-value filters" \
  "bug,frontend,dashboard,demo-seed,test-needed" \
  "## Summary
When a native filter has multiple selected values including \`0\`, the label formatter drops zero from the displayed label.

## Expected behavior
- \`[0, 1, 2]\` should display as \`\"0, 1, 2\"\`
- Empty/null entries should still be filtered out

## Actual behavior
Numeric \`0\` is removed from multi-value filter labels.

## Affected area
- \`superset-frontend/src/dashboard/components/nativeFilters/selectors.ts\` — \`extractLabel()\`

## Acceptance criteria
- [ ] \`extractLabel({ value: [0, 1] })\` returns \`\"0, 1\"\`
- [ ] \`null\`, \`undefined\`, and \`\"\"\` entries are still excluded
- [ ] Unit test added for zero in multi-value arrays
${COMMON_FOOTER}"

# ---------------------------------------------------------------------------
# Issue 10 — test gap only (no code bug in seed script)
# ---------------------------------------------------------------------------
create_issue \
  "Test gap: add regression coverage for falsy-but-valid dashboard filter values" \
  "bug,demo-seed,test-needed,frontend,backend" \
  "## Summary
Dashboard filter display and backend normalization paths lack consolidated regression coverage for values that are falsy in JavaScript/Python but semantically valid (\`0\`, \`false\`, \`\"\"\` edge cases).

## Expected behavior
Add focused unit tests documenting intended behavior across:
- \`getFilterValueForDisplay()\`
- \`extractLabel()\`
- \`CustomizationsBadge\` active-value detection
- \`get_since_until()\` empty/whitespace bounds
- \`parse_boolean_string()\` whitespace handling
- \`RisonFilterParser.parse()\` empty-string input

## Actual behavior
No consolidated regression suite exists for these falsy-but-valid edge cases on branch \`${TARGET_BRANCH}\`.

## Affected area
- \`superset-frontend/src/dashboard/components/nativeFilters/\`
- \`superset-frontend/src/dashboard/components/CustomizationsBadge/\`
- \`superset/utils/date_parser.py\`
- \`superset/utils/core.py\`
- \`superset/utils/rison_filters.py\`

## Acceptance criteria
- [ ] Frontend tests cover \`0\`, \`false\`, and empty/null filter values
- [ ] Backend tests cover empty-string and whitespace-only time range bounds
- [ ] Backend tests cover whitespace-padded boolean strings and empty Rison \`f\` param
- [ ] Tests fail on the seeded bugs and pass after remediation
${COMMON_FOOTER}"

echo ""
echo "Done. Created 10 demo issues on ${GITHUB_REPO}."
echo "Confirmed: no issues were labeled devin-remediate."
