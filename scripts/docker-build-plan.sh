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

set -euo pipefail

EVENT_NAME="${1:-${GITHUB_EVENT_NAME:-}}"
REF="${2:-${GITHUB_REF:-}}"
REF_NAME="${3:-${GITHUB_REF_NAME:-}}"
# Optional: a single platform (linux/amd64 or linux/arm64) for a master
# publish. The docker workflow builds each platform natively in its own job
# (QEMU emulation of arm64 on an amd64 runner took most of the build time) and
# merges the two manifests afterwards, so each job asks for its own platform.
# Without it a master publish keeps the combined multi-platform plan, which
# the release workflow's single-job build still uses.
PLATFORM="${4:-}"

BUILD_CONTEXT="$EVENT_NAME"
BUILD_CONTEXT_REF=""
PUBLISH_DOCKER_CACHE=""

if [ "$EVENT_NAME" = "push" ] && [ "$REF" = "refs/heads/master" ]; then
  if [ -n "$PLATFORM" ]; then
    PLATFORM_ARG="--platform $PLATFORM"
  else
    PLATFORM_ARG="--platform linux/arm64 --platform linux/amd64"
  fi
  PUSH_OR_LOAD="--push"
  BUILD_CONTEXT_REF="${REF_NAME:-master}"
  PUBLISH_DOCKER_CACHE="true"
elif [ "$EVENT_NAME" = "push" ] || [ "$EVENT_NAME" = "pull_request" ]; then
  PLATFORM_ARG="--platform linux/amd64"
  PUSH_OR_LOAD="--load"
else
  echo "Unsupported GitHub event for docker build: $EVENT_NAME" >&2
  exit 1
fi

emit() {
  printf '%s=%q\n' "$1" "$2"
}

emit BUILD_CONTEXT "$BUILD_CONTEXT"
emit BUILD_CONTEXT_REF "$BUILD_CONTEXT_REF"
emit PLATFORM_ARG "$PLATFORM_ARG"
emit PUSH_OR_LOAD "$PUSH_OR_LOAD"
emit PUBLISH_DOCKER_CACHE "$PUBLISH_DOCKER_CACHE"
