#!/usr/bin/env bash
#
# Licensed to the Apache Software Foundation (ASF) under one or more
# contributor license agreements.  See the NOTICE file distributed with
# this work for additional information regarding copyright ownership.
# The ASF licenses this file to You under the Apache License, Version 2.0
# (the "License"); you may not use this file except in compliance with
# the License.  You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
# Runs the same read-only checks the nightly-scan automation runs, so a
# finding in a `nightly-scan` issue can be reproduced locally. Nothing here
# writes to GitHub or changes the repo.
#
#   scan.sh [python-advisories|npm-advisories|outdated-deps|ci-supply-chain|frontend-lint|code-hardening|all]
#
set -uo pipefail

ROOT="${WORKSPACE:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
OUT="${SCAN_OUT:-$ROOT/automation/out}"
mkdir -p "$OUT"
cd "$ROOT"

section() { printf '\n==== %s ====\n' "$1"; }

python_advisories() {
  section "python-advisories: pip-audit against pinned requirements"
  for f in requirements/base.txt requirements/development.txt; do
    echo "--- $f"
    # --disable-pip audits the exact pins without building any wheel locally
    pip-audit --disable-pip --no-deps -r "$f" -f json -o "$OUT/pip-audit-$(basename "$f" .txt).json" \
      || case $? in
           1) ;;  # exit 1 means vulnerabilities were found; the summary line above says how many
           *) echo "pip-audit could not audit $f (the automation falls back to the OSV batch API)" ;;
         esac
  done
}

npm_advisories() {
  section "npm-advisories: npm audit per lockfile workspace"
  for ws in superset-frontend superset-websocket superset-embedded-sdk; do
    [ -f "$ws/package-lock.json" ] || continue
    echo "--- $ws"
    (cd "$ws" && npm audit --audit-level=moderate --package-lock-only --json \
      > "$OUT/npm-audit-$ws.json"; true)
    jq -r '.metadata.vulnerabilities // {} | to_entries[] | "\(.key): \(.value)"' \
      "$OUT/npm-audit-$ws.json" 2>/dev/null || true
  done
}

outdated_deps() {
  section "outdated-deps: npm outdated in superset-frontend"
  (cd superset-frontend && npm outdated --json > "$OUT/npm-outdated.json"; true)
  jq -r 'to_entries[] | "\(.key): \(.value.current) -> \(.value.latest)"' \
    "$OUT/npm-outdated.json" 2>/dev/null | head -50
  echo "(Python pins are compared against PyPI by the automation; see requirements/base.in for deliberate caps.)"
}

ci_supply_chain() {
  section "ci-supply-chain: risky patterns in .github/workflows"
  grep -rn "pull_request_target" .github/workflows || echo "no pull_request_target"
  echo "--- third-party actions not pinned to a commit SHA"
  grep -rhoE "uses: [^@]+@[^ ]+" .github/workflows \
    | grep -vE "@[0-9a-f]{40}$" | grep -v "uses: ./" | sort | uniq -c | sort -rn | head -30
  echo "--- unpinned installs"
  grep -rnE "(pip|npm) install " .github/workflows | grep -vE "==|@[0-9]" | head -20
}

frontend_lint() {
  section "frontend-lint: oxlint warnings in production code (needs node_modules)"
  if [ ! -d superset-frontend/node_modules ]; then
    echo "superset-frontend/node_modules missing; run 'npm ci' there first (slow, ~5 min)"
    return
  fi
  (cd superset-frontend && npx oxlint --config oxlint.json --format json > "$OUT/oxlint.json"; true)
  jq -r '[.diagnostics[] | select(.filename | test("(\\.test\\.|\\.stories\\.|/test/|cypress|playwright|__mocks__)") | not) | .code] | group_by(.) | map({rule: .[0], n: length}) | sort_by(-.n)[] | "\(.n)\t\(.rule)"' \
    "$OUT/oxlint.json" 2>/dev/null | head -25
}

code_hardening() {
  section "code-hardening: bandit + radon + ruff"
  bandit -q -r superset superset-core superset-extensions-cli -ll -f json -o "$OUT/bandit.json" || true
  jq -r '.results | length as $n | "bandit medium+ findings: \($n) (most carry an intentional noqa; triage before reporting)"' "$OUT/bandit.json"
  radon cc superset -n E -j > "$OUT/radon.json"
  jq -r 'to_entries[] | .key as $f | .value[] | "\(.complexity)\t\(.rank)\t\($f):\(.lineno) \(.name)"' "$OUT/radon.json" | sort -rn | head -15
  ruff check . --statistics && echo "ruff check: no violations" || true
  ruff format --check . | tail -1 || true
}

case "${1:-all}" in
  python-advisories) python_advisories ;;
  npm-advisories) npm_advisories ;;
  outdated-deps) outdated_deps ;;
  ci-supply-chain) ci_supply_chain ;;
  frontend-lint) frontend_lint ;;
  code-hardening) code_hardening ;;
  all) python_advisories; npm_advisories; outdated_deps; ci_supply_chain; frontend_lint; code_hardening ;;
  *) echo "unknown category: $1"; exit 2 ;;
esac

echo
echo "raw reports written to $OUT"
