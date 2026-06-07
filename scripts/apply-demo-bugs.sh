#!/usr/bin/env bash
# Apply seeded demo bugs for Cognition/Devin IssueOps demo.
# Usage:
#   ./scripts/apply-demo-bugs.sh          # apply, commit, push
#   DRY_RUN=1 ./scripts/apply-demo-bugs.sh  # preview diff only (no commit/push)
set -euo pipefail

BRANCH="devin-demo-target-v2"
COMMIT_MSG="Add seeded demo remediation targets"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DRY_RUN="${DRY_RUN:-0}"

cd "$REPO_ROOT"

echo "==> Fetching origin"
git fetch origin

echo "==> Resetting branch ${BRANCH} from origin/master"
if [[ "$DRY_RUN" == "1" ]]; then
  git stash push -u -m "apply-demo-bugs dry-run" >/dev/null 2>&1 || true
  git checkout -B "${BRANCH}" origin/master
else
  git checkout -B "${BRANCH}" origin/master
fi

echo "==> Applying demo bug patches"
python3 <<'PY'
from pathlib import Path

ROOT = Path(".")

patches: list[tuple[Path, str, str]] = [
    # Bug 1: numeric zero treated as empty in dashboard filter display
    (
        ROOT / "superset-frontend/src/dashboard/components/nativeFilters/utils.ts",
        "    return `${value}`;",
        "    return value ? `${value}` : '';",
    ),
    # Bug 2: boolean false treated as empty in dashboard filter display
    (
        ROOT / "superset-frontend/src/dashboard/components/nativeFilters/utils.ts",
        """  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string' || typeof value === 'number') {""",
        """  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : '';
  }
  if (typeof value === 'string' || typeof value === 'number') {""",
    ),
    # Bug 3: empty string time-range bounds not normalized to None
    (
        ROOT / "superset/utils/date_parser.py",
        """            if not part:
                # if since or until is "", set as None
                since_and_until.append(None)
                continue""",
        """            if part is None:
                since_and_until.append(None)
                continue""",
    ),
    # Bug 4: whitespace-only bounds not trimmed before empty check
    (
        ROOT / "superset/utils/date_parser.py",
        "        since_and_until_partition = [_.strip() for _ in time_range.split(separator, 1)]",
        "        since_and_until_partition = time_range.split(separator, 1)",
    ),
    # Bug 5: empty until string parsed instead of defaulting
    (
        ROOT / "superset/utils/date_parser.py",
        """        _until = (
            parse_human_datetime(until)
            if until
            else parse_human_datetime(_relative_end)
        )""",
        """        _until = (
            parse_human_datetime(until)
            if until is not None
            else parse_human_datetime(_relative_end)
        )""",
    ),
    # Bug 6: boolean strings with surrounding whitespace parse incorrectly
    (
        ROOT / "superset/utils/core.py",
        '    return bool_str.lower() in ("y", "Y", "yes", "True", "t", "true", "On", "on", "1")',
        '    return bool_str in ("y", "Y", "yes", "True", "t", "true", "On", "on", "1")',
    ),
    # Bug 7: empty Rison filter string attempts parse instead of no-op
    (
        ROOT / "superset/utils/rison_filters.py",
        """        if not filter_string:
            return []""",
        """        if filter_string is None:
            return []""",
    ),
    # Bug 8: customizations badge excludes zero/false from active count
    (
        ROOT
        / "superset-frontend/src/dashboard/components/CustomizationsBadge/index.tsx",
        "      return value !== null && value !== undefined;",
        "      return !!value;",
    ),
    # Bug 9: extractLabel drops numeric zero in multi-select filter values
    (
        ROOT / "superset-frontend/src/dashboard/components/nativeFilters/selectors.ts",
        "    const nonEmpty = arr.filter(v => v != null && v !== '');",
        "    const nonEmpty = arr.filter(v => v != null && v !== '' && v);",
    ),
]

for path, old, new in patches:
    text = path.read_text()
    if old not in text:
        raise SystemExit(f"PATCH FAILED: pattern not found in {path}")
    if new in text:
        raise SystemExit(f"PATCH FAILED: target already patched in {path}")
    path.write_text(text.replace(old, new, 1))
    print(f"  patched {path}")

print("All demo bug patches applied.")
PY

echo ""
echo "==> Diff summary"
git diff --stat

echo ""
echo "==> Full diff"
git diff

if [[ "$DRY_RUN" == "1" ]]; then
  echo ""
  echo "DRY_RUN=1: skipping commit and push."
  echo "Working tree left dirty on ${BRANCH} for inspection."
  echo "To discard: git checkout -- . && git checkout -"
  exit 0
fi

echo ""
echo "==> Committing"
git add \
  superset-frontend/src/dashboard/components/nativeFilters/utils.ts \
  superset-frontend/src/dashboard/components/nativeFilters/selectors.ts \
  superset-frontend/src/dashboard/components/CustomizationsBadge/index.tsx \
  superset/utils/date_parser.py \
  superset/utils/core.py \
  superset/utils/rison_filters.py

git commit -m "$COMMIT_MSG"

echo ""
echo "==> Pushing to origin/${BRANCH}"
git push -u origin "$BRANCH"

echo ""
echo "Done. Branch: ${BRANCH}"
git log -1 --oneline
