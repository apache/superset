#!/usr/bin/env bash
# Create GitHub issues for seeded demo bugs (no devin-remediate label).
# Issue definitions live in scripts/demo-issues/*.issue.md
#
# Usage:
#   ./scripts/create-demo-issues.sh
#   GITHUB_REPO=AFadhluddin/superset ./scripts/create-demo-issues.sh
set -euo pipefail

TARGET_BRANCH="devin-demo-target-v2"
GITHUB_REPO="${GITHUB_REPO:-AFadhluddin/superset}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ISSUES_DIR="${REPO_ROOT}/scripts/demo-issues"

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
  available="$(gh api "repos/${GITHUB_REPO}/labels" --paginate --jq '.[].name' 2>/dev/null || true)"
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
  if [[ ${#result[@]} -eq 0 ]]; then
    echo ""
  else
    (IFS=','; echo "${result[*]}")
  fi
}

parse_issue_file() {
  local file="$1"
  python3 - "$file" <<'PY'
import sys
from pathlib import Path

text = Path(sys.argv[1]).read_text()
if not text.startswith("---"):
    raise SystemExit(f"Invalid issue file (missing frontmatter): {sys.argv[1]}")

_, frontmatter, body = text.split("---", 2)
meta: dict[str, str] = {}
for line in frontmatter.strip().splitlines():
    key, _, value = line.partition(":")
    meta[key.strip()] = value.strip().strip('"')

print(meta.get("title", ""))
print(meta.get("labels", ""))
print(body.strip())
PY
}

create_issue_from_file() {
  local file="$1"
  local parsed title labels body filtered url number existing

  parsed="$(parse_issue_file "$file")"
  title="$(echo "$parsed" | sed -n '1p')"
  labels="$(echo "$parsed" | sed -n '2p')"
  body="$(echo "$parsed" | sed -n '3,$p')"

  existing="$(gh issue list --repo "$GITHUB_REPO" --state open --search "$title in:title" --json number,title --jq '.[0].number // empty' 2>/dev/null || true)"
  if [[ -n "$existing" ]]; then
    echo ""
    echo "Skipping (already exists): $title (#${existing})"
    gh issue comment "$existing" --repo "$GITHUB_REPO" \
      --body "Target branch for remediation: ${TARGET_BRANCH}" 2>/dev/null || \
      gh api "repos/${GITHUB_REPO}/issues/${existing}/comments" \
        -f body="Target branch for remediation: ${TARGET_BRANCH}" >/dev/null
    echo "  https://github.com/${GITHUB_REPO}/issues/${existing}"
    return 0
  fi

  filtered="$(filter_labels "$labels")"

  if [[ -n "$filtered" ]]; then
    echo ""
    echo "Creating: $title"
    echo "  labels: $filtered"
    url="$(gh issue create --repo "$GITHUB_REPO" --title "$title" --body "$body" --label "$filtered")"
  else
    echo ""
    echo "Creating: $title"
    echo "  labels: (none applied)"
    url="$(gh issue create --repo "$GITHUB_REPO" --title "$title" --body "$body")"
  fi

  number="${url##*/}"

  gh issue comment "$number" --repo "$GITHUB_REPO" \
    --body "Target branch for remediation: ${TARGET_BRANCH}" 2>/dev/null || \
    gh api "repos/${GITHUB_REPO}/issues/${number}/comments" \
      -f body="Target branch for remediation: ${TARGET_BRANCH}" >/dev/null

  echo "  created: $url"
}

shopt -s nullglob
issue_files=("${ISSUES_DIR}"/*.issue.md)
if [[ ${#issue_files[@]} -eq 0 ]]; then
  echo "No issue files found in ${ISSUES_DIR}"
  exit 1
fi

for file in "${issue_files[@]}"; do
  create_issue_from_file "$file"
done

echo ""
echo "Done. Created ${#issue_files[@]} demo issues on ${GITHUB_REPO}."
echo "Confirmed: no issues were labeled devin-remediate."
