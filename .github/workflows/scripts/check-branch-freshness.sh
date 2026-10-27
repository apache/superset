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
# Shared freshness gate for push-triggered workflows that serialize their
# real work behind a static (per-branch) concurrency group with
# cancel-in-progress: false — e.g. the Docs Deployment workflow
# (superset-docs-deploy.yml, both up front at check-freshness and again right
# before the deploy step at recheck-freshness) and the Docker image build
# workflow (docker.yml, check-freshness). Writes an output declaring whether
# BUILD_SHA is still BRANCH's current tip, so a superseded run can skip
# cleanly at the job level instead of entering the concurrency group, where a
# burst of pushes would otherwise queue several runs behind each other and
# have GitHub force-cancel all but the newest pending one — the queue
# pruning described at
# https://docs.github.com/en/actions/using-jobs/using-concurrency, which
# happens regardless of cancel-in-progress and is why a merely-superseded
# run shows up as a failing "Cancelled" check instead of a clean "Skipped"
# one.
#
# Required env vars:
#   BUILD_SHA     - the commit SHA this run is building
#   REPO          - "owner/repo" to query, e.g. github.repository
#   OUTPUT_NAME   - the GITHUB_OUTPUT key to write, e.g. "is-current"
#   GITHUB_OUTPUT - path to append outputs to (set by the Actions runner)
# Optional env vars:
#   BRANCH        - the branch whose tip BUILD_SHA is checked against;
#                   defaults to "master"
#   EVENT_NAME    - if "workflow_dispatch" or "pull_request", bypasses the
#                   check and always reports current: a manual dispatch is a
#                   deliberate, one-off action, and a pull_request build has
#                   no branch tip to race against (PR staleness is instead
#                   handled by that workflow's own cancel-in-progress: true)
#   FAIL_OPEN     - if "true", a failed branch-tip lookup reports current
#                   (a blip costs at most a redundant build). Unset, the
#                   script fails closed and exits non-zero, which is what a
#                   guard against overwriting newer work (the docs deploy
#                   recheck) needs
#   GH_TOKEN      - passed through to `gh`, needed to call the GitHub API

set -euo pipefail

branch="${BRANCH:-master}"

if [ "${EVENT_NAME:-}" = "workflow_dispatch" ] || [ "${EVENT_NAME:-}" = "pull_request" ]; then
  echo "${OUTPUT_NAME}=true" >>"$GITHUB_OUTPUT"
  exit 0
fi

if ! latest_sha="$(gh api "repos/${REPO}/commits/${branch}" --jq .sha)"; then
  if [ "${FAIL_OPEN:-}" = "true" ]; then
    # Opt-in: a transient API failure costs at most a redundant build rather
    # than failing the required job and skipping the build entirely.
    echo "::warning::Could not look up the tip of ${branch}; assuming ${BUILD_SHA} is current."
    echo "${OUTPUT_NAME}=true" >>"$GITHUB_OUTPUT"
    exit 0
  fi
  echo "::error::Could not look up the tip of ${branch}."
  exit 1
fi
if [ "${latest_sha}" = "${BUILD_SHA}" ]; then
  echo "${OUTPUT_NAME}=true" >>"$GITHUB_OUTPUT"
else
  echo "${OUTPUT_NAME}=false" >>"$GITHUB_OUTPUT"
  echo "::notice::${branch} has moved on to ${latest_sha} since ${BUILD_SHA} was triggered — skipping this stale run."
fi
