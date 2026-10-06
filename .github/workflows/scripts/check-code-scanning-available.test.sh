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
# Exercises check-code-scanning-available.sh against a stubbed `curl`,
# covering the "not enabled" rejection and the fail-open branches so the
# output contract (available=true|false) can't silently regress. Run
# directly, no extra tooling required:
#   bash .github/workflows/scripts/check-code-scanning-available.test.sh

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
script_under_test="${script_dir}/check-code-scanning-available.sh"

failures=0

# Runs the script under test with a stubbed `curl` that replies with HTTP
# status $2 and body $3 and exits with $4, asserting that GITHUB_OUTPUT ends
# up containing exactly $5.
run_case() {
  local case_name="$1"
  local http_status="$2"
  local response_body="$3"
  local curl_exit_code="$4"
  local expected_line="$5"

  local workdir
  workdir="$(mktemp -d)"
  trap 'rm -rf "${workdir}"' RETURN

  # Fake `curl` that replays a canned response regardless of arguments, so
  # the script under test never touches the network. The status follows the
  # body on its own line, as the real `--write-out` format produces.
  printf '%s\n%s' "${response_body}" "${http_status}" >"${workdir}/response"
  cat >"${workdir}/curl" <<EOF
#!/bin/bash
cat '${workdir}/response'
exit ${curl_exit_code}
EOF
  chmod +x "${workdir}/curl"

  local output_file="${workdir}/github_output"
  : >"${output_file}"

  if PATH="${workdir}:${PATH}" \
    GITHUB_OUTPUT="${output_file}" \
    GITHUB_REPOSITORY="apache/superset" \
    GH_TOKEN="fake-token" \
    bash "${script_under_test}" >/dev/null; then
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

run_case "alerts are readable" \
  200 '[{"number":1,"state":"open"}]' 0 \
  "available=true"

run_case "no alerts yet" \
  200 '[]' 0 \
  "available=true"

run_case "Code Security is not enabled" \
  403 '{"message":"Code Security must be enabled for this repository to use code scanning.","status":"403"}' 0 \
  "available=false"

run_case "Advanced Security is not enabled" \
  403 '{"message":"Advanced Security must be enabled for this repository to use code scanning.","status":"403"}' 0 \
  "available=false"

run_case "an alert merely quotes the rejection message" \
  200 '[{"rule":{"description":"Code Security must be enabled for this repository"}}]' 0 \
  "available=true"

run_case "token cannot read alerts" \
  403 '{"message":"Resource not accessible by integration","status":"403"}' 0 \
  "available=true"

run_case "no analysis found" \
  404 '{"message":"no analysis found","status":"404"}' 0 \
  "available=true"

run_case "network failure" \
  000 '' 28 \
  "available=true"

if [ "${failures}" -gt 0 ]; then
  echo "${failures} case(s) failed"
  exit 1
fi

echo "All cases passed"
