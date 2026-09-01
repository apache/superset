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
# Shared freshness gate used by the Docs Deployment workflow
# (superset-docs-deploy.yml) both up front (check-freshness) and again right
# before the deploy step (recheck-freshness). Writes an output declaring
# whether BUILD_SHA is still master's current tip, so a superseded run can
# skip cleanly instead of racing (and clobbering, or being force-cancelled
# by) a fresher run.
#
# Required env vars:
#   BUILD_SHA     - the commit SHA this run is building
#   REPO          - "owner/repo" to query, e.g. github.repository
#   OUTPUT_NAME   - the GITHUB_OUTPUT key to write, e.g. "is-current"
#   GITHUB_OUTPUT - path to append outputs to (set by the Actions runner)
# Optional env vars:
#   EVENT_NAME    - if "workflow_dispatch", bypasses the check and always
#                   reports current, since a manual dispatch is a deliberate,
#                   one-off action rather than something racing other triggers
#   GH_TOKEN      - passed through to `gh`, needed to call the GitHub API

set -euo pipefail

if [ "${EVENT_NAME:-}" = "workflow_dispatch" ]; then
  echo "${OUTPUT_NAME}=true" >>"$GITHUB_OUTPUT"
  exit 0
fi

latest_sha="$(gh api "repos/${REPO}/commits/master" --jq .sha)"
if [ "${latest_sha}" = "${BUILD_SHA}" ]; then
  echo "${OUTPUT_NAME}=true" >>"$GITHUB_OUTPUT"
else
  echo "${OUTPUT_NAME}=false" >>"$GITHUB_OUTPUT"
  echo "::notice::master has moved on to ${latest_sha} since ${BUILD_SHA} was triggered — skipping this stale run."
fi
