#!/usr/bin/env bash
# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.

# Decides whether a docker-build job may publish the mutable `master*` tags.
#
# Concurrency serializes the master matrix per preset, but it does not order
# the runs that enter it: if push A's change-detection job is slow and push B's
# is fast, B acquires the lock and publishes, then A acquires it and
# republishes `master`, `master-dev`, ... from the older commit. Comparing the
# building SHA against the branch tip at that point rejects A.
#
# Only master publishing is gated. Release branches and pull requests build
# with --load and move no mutable tag, so they always proceed.
#
# Usage: docker-publish-guard.sh <event_name> <ref> <sha> <tip_sha>
# Emits: PUBLISH=true|false

set -euo pipefail

EVENT_NAME="${1:?usage: docker-publish-guard.sh <event_name> <ref> <sha> <tip_sha>}"
REF="${2:-}"
SHA="${3:-}"
TIP_SHA="${4:-}"

PUBLISH="true"
if [ "$EVENT_NAME" = "push" ] && [ "$REF" = "refs/heads/master" ]; then
  if [ -z "$SHA" ] || [ -z "$TIP_SHA" ]; then
    # An unresolvable tip (network failure, empty ref) must not silently
    # degrade into publishing from a possibly stale commit.
    echo "Could not compare the building SHA against the master tip" >&2
    exit 1
  fi
  if [ "$SHA" != "$TIP_SHA" ]; then
    PUBLISH="false"
  fi
fi

printf 'PUBLISH=%q\n' "$PUBLISH"
