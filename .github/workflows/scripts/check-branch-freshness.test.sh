#!/bin/bash
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
# Exercises check-branch-freshness.sh against a stubbed `gh`, covering the
# dispatch-bypass, pull_request-bypass, current-tip, stale-tip and
# explicit-BRANCH cases so the output contract (is-current / still-current)
# can't silently regress. Run directly, no extra tooling required:
#   bash .github/workflows/scripts/check-branch-freshness.test.sh

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
script_under_test="${script_dir}/check-branch-freshness.sh"

failures=0

# Runs the script under test with a stubbed `gh` reporting $1 as the
# configured branch's latest sha, asserting that GITHUB_OUTPUT ends up
# containing exactly $5 and (unless empty) that `gh` was actually called
# against the expected branch, to catch BRANCH silently not being honored.
run_case() {
  local case_name="$1"
  local latest_sha="$2"
  local build_sha="$3"
  local event_name="$4"
  local expected_line="$5"
  local branch="${6:-}"
  local expect_branch="${7:-}"

  local workdir
  workdir="$(mktemp -d)"
  trap 'rm -rf "${workdir}"' RETURN

  # Fake `gh` that records the requested commits path and echoes back the
  # requested "latest" sha, so the script under test never touches the
  # network and the branch it actually queried can be asserted on.
  cat >"${workdir}/gh" <<EOF
#!/bin/bash
echo "\$@" >>"${workdir}/gh-args"
echo '${latest_sha}'
EOF
  chmod +x "${workdir}/gh"

  local output_file="${workdir}/github_output"
  : >"${output_file}"

  if PATH="${workdir}:${PATH}" \
    GITHUB_OUTPUT="${output_file}" \
    OUTPUT_NAME="is-current" \
    REPO="apache/superset" \
    BUILD_SHA="${build_sha}" \
    EVENT_NAME="${event_name}" \
    BRANCH="${branch}" \
    GH_TOKEN="fake-token" \
    bash "${script_under_test}"; then
    :
  else
    echo "FAIL (${case_name}): script exited non-zero"
    failures=$((failures + 1))
    return
  fi

  local actual
  actual="$(cat "${output_file}")"
  if [ "${actual}" != "${expected_line}" ]; then
    echo "FAIL (${case_name}): expected '${expected_line}', got '${actual}'"
    failures=$((failures + 1))
    return
  fi

  if [ -n "${expect_branch}" ]; then
    if ! grep -q "repos/apache/superset/commits/${expect_branch}" "${workdir}/gh-args" 2>/dev/null; then
      echo "FAIL (${case_name}): expected gh to be queried against branch '${expect_branch}'"
      failures=$((failures + 1))
      return
    fi
  fi

  echo "PASS (${case_name})"
}

# `gh` prints "should-not-be-called" for the bypass cases below the trick:
# it's never actually invoked since the bypass short-circuits before the
# `gh api` call, but the fake still needs a body.
run_case "workflow_dispatch bypasses the check" \
  "unused" "abc123" "workflow_dispatch" \
  "is-current=true"

run_case "pull_request bypasses the check" \
  "unused" "abc123" "pull_request" \
  "is-current=true"

run_case "build sha matches master's tip (default branch)" \
  "abc123" "abc123" "push" \
  "is-current=true" "" "master"

run_case "build sha is stale (default branch)" \
  "def456" "abc123" "push" \
  "is-current=false" "" "master"

run_case "build sha matches an explicit release branch's tip" \
  "abc123" "abc123" "push" \
  "is-current=true" "7.0" "7.0"

run_case "build sha is stale on an explicit release branch" \
  "def456" "abc123" "push" \
  "is-current=false" "7.0" "7.0"

if [ "${failures}" -gt 0 ]; then
  echo "${failures} case(s) failed"
  exit 1
fi

echo "All cases passed"
