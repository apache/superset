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

BUILD_CONTEXT="$EVENT_NAME"
BUILD_CONTEXT_REF=""
PUBLISH_DOCKER_CACHE=""

if [ "$EVENT_NAME" = "push" ] && [ "$REF" = "refs/heads/master" ]; then
  PLATFORM_ARG="--platform linux/arm64 --platform linux/amd64"
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
