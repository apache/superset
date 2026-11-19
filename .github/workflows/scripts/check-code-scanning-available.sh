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
# Reports whether the repository can accept code scanning (SARIF) uploads,
# so jobs whose only product is such an upload can be skipped where the
# upload is guaranteed to be rejected -- e.g. a private fork or mirror
# without GitHub Code Security, where the analysis would run to completion
# and then fail at the upload step on every push.
#
# Fails open: only GitHub's explicit "must be enabled" rejection counts as
# unavailable. Any other response (success, an empty alert list, a token
# without permission to read alerts, a network error) reports available, so
# the upstream repository and forks that do have code scanning are never
# skipped by mistake.
#
# Required env:
#   GH_TOKEN          - token used to query the code scanning API
#   GITHUB_REPOSITORY - "owner/repo" to query
#   GITHUB_OUTPUT     - path to the step's output file
# Optional env:
#   GITHUB_API_URL    - API root, defaults to https://api.github.com
#   OUTPUT_NAME       - output key to write, defaults to "available"

set -euo pipefail

output_name="${OUTPUT_NAME:-available}"
api_url="${GITHUB_API_URL:-https://api.github.com}"

# The response body can contain alert details, so it is inspected but never
# printed. The HTTP status is appended on its own line so that an alert whose
# text happens to contain the rejection message is not mistaken for it.
response="$(
  curl --silent --max-time 30 \
    --write-out '\n%{http_code}' \
    --header "Authorization: Bearer ${GH_TOKEN}" \
    --header "Accept: application/vnd.github+json" \
    "${api_url}/repos/${GITHUB_REPOSITORY}/code-scanning/alerts?per_page=1" \
    2>/dev/null || true
)"
status="${response##*$'\n'}"
body="${response%$'\n'*}"

available=true
if [ "${status}" = "403" ] && grep --quiet --extended-regexp \
  '(Code|Advanced) Security must be enabled' <<<"${body}"; then
  available=false
  echo "Code scanning is not enabled for ${GITHUB_REPOSITORY}; jobs that only upload code scanning results will be skipped."
fi

echo "${output_name}=${available}" >>"${GITHUB_OUTPUT}"
