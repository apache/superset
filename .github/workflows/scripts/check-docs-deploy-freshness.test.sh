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
# Exercises check-docs-deploy-freshness.sh against a stubbed `gh`, covering
# the dispatch-bypass, current-tip and stale-tip branches so the output
# contract (is-current / still-current) can't silently regress. Run
# directly, no extra tooling required:
#   bash .github/workflows/scripts/check-docs-deploy-freshness.test.sh

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
script_under_test="${script_dir}/check-docs-deploy-freshness.sh"

failures=0

# Runs the script under test with a stubbed `gh` reporting $1 as master's
# latest sha, asserting that GITHUB_OUTPUT ends up containing exactly $4.
run_case() {
  local case_name="$1"
  local latest_sha="$2"
  local build_sha="$3"
  local event_name="$4"
  local expected_line="$5"

  local workdir
  workdir="$(mktemp -d)"
  trap 'rm -rf "${workdir}"' RETURN

  # Fake `gh` that just echoes back the requested "latest" sha regardless of
  # arguments, so the script under test never touches the network.
  cat >"${workdir}/gh" <<EOF
#!/bin/bash
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
  if [ "${actual}" = "${expected_line}" ]; then
    echo "PASS (${case_name})"
  else
    echo "FAIL (${case_name}): expected '${expected_line}', got '${actual}'"
    failures=$((failures + 1))
  fi
}

# `gh` prints "should-not-be-called" for the dispatch case above the trick:
# it's never actually invoked since the bypass short-circuits before the
# `gh api` call, but the fake still needs a body.
run_case "workflow_dispatch bypasses the check" \
  "unused" "abc123" "workflow_dispatch" \
  "is-current=true"

run_case "build sha matches master's tip" \
  "abc123" "abc123" "push" \
  "is-current=true"

run_case "build sha is stale" \
  "def456" "abc123" "push" \
  "is-current=false"

if [ "${failures}" -gt 0 ]; then
  echo "${failures} case(s) failed"
  exit 1
fi

echo "All cases passed"
