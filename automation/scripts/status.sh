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
# Shows whether the automation pipeline is healthy: which nightly-scan issues
# are open, which of them already have a fix PR (branch devin/nightly-fix-<N>-*),
# and, when DEVIN_API_KEY is set, the state of the Devin sessions behind them.
#
# Requires: gh (authenticated via GH_TOKEN or `gh auth login`), jq, curl.
#
set -euo pipefail

REPO="${REPO:-moliyadhaval/superset}"
ORG_ID="${DEVIN_ORG_ID:-org-eef03b923043402190c037ffa8141840}"

echo "== Open nightly-scan issues on $REPO"
gh issue list -R "$REPO" --state open --label nightly-scan --limit 300 \
  --json number,title,createdAt > /tmp/issues.json
gh pr list -R "$REPO" --state all --limit 500 --json number,state,headRefName,url > /tmp/prs.json

jq -r --slurpfile prs /tmp/prs.json '
  ($prs[0] | map(select(.headRefName | test("^devin/nightly-fix-(issue-)?[0-9]+")))
    | map({key: (.headRefName | capture("nightly-fix-(issue-)?(?<n>[0-9]+)").n), value: "#\(.number) (\(.state))"})
    | from_entries) as $byIssue
  | sort_by(-.number)[]
  | "\(.number)\t\(.createdAt[:10])\t\($byIssue[(.number|tostring)] // "no PR yet")\t\(.title[:70])"' /tmp/issues.json \
  | column -t -s $'\t'

echo
echo "== Counts"
jq -r 'length as $n | "open issues: \($n)"' /tmp/issues.json
jq -r 'map(select(.headRefName | startswith("devin/"))) | group_by(.state) | map("\(.[0].state): \(length)") | "automation PRs by state: " + join(", ")' /tmp/prs.json

if [ -n "${DEVIN_API_KEY:-}" ]; then
  echo
  echo "== Devin auto-fix sessions (latest 100)"
  curl -sf -H "Authorization: Bearer ${DEVIN_API_KEY}" \
    "https://api.devin.ai/v3/organizations/${ORG_ID}/sessions?tags=auto-fix&limit=100" \
    | jq -r '(.items // .sessions // [])[] | "\(.status // .status_enum)\t\(.title)\thttps://app.devin.ai/sessions/\(.session_id | ltrimstr("devin-"))"' \
    | column -t -s $'\t'
else
  echo
  echo "(set DEVIN_API_KEY to also list the Devin sessions behind these issues)"
fi
