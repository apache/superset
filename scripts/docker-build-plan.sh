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
BUILD_PRESET="${4:-${BUILD_PRESET:-}}"
SHA="${5:-${GITHUB_SHA:-}}"
REPOSITORY="${6:-${GITHUB_REPOSITORY:-}}"

# Only this repository holds credentials for the apache/* Docker Hub namespace,
# and the login step in .github/actions/setup-docker is continue-on-error. A
# fork pushing a release branch must therefore keep validating locally rather
# than spending an hour on a build that ends in a registry 401.
PUBLISHING_REPOSITORY="apache/superset"

# A release branch is named exactly `N.N`. The workflow's push filter is looser
# than that -- "[0-9].[0-9]*" also matches branches like `0.36.0-lyft1` -- so
# the branch is taken from this capture rather than from the caller-supplied
# $REF_NAME, and can only ever be digits and a dot. Nothing derived from an
# arbitrary branch name reaches a published tag.
RELEASE_BRANCH_RE='^refs/heads/([0-9]+\.[0-9]+)$'

# Presets a release branch publishes: the images people actually deploy or
# debug with. Every other preset still builds, but only as --load validation.
RELEASE_BRANCH_PRESETS=" superset lean dev "

BUILD_CONTEXT="$EVENT_NAME"
BUILD_CONTEXT_REF=""
PUBLISH_DOCKER_CACHE=""
RELEASE_BRANCH_TAG=""

if [ "$EVENT_NAME" = "push" ] && [ "$REF" = "refs/heads/master" ]; then
  PLATFORM_ARG="--platform linux/arm64 --platform linux/amd64"
  PUSH_OR_LOAD="--push"
  BUILD_CONTEXT_REF="${REF_NAME:-master}"
  PUBLISH_DOCKER_CACHE="true"
elif [ "$EVENT_NAME" = "push" ] &&
  [ "$REPOSITORY" = "$PUBLISHING_REPOSITORY" ] &&
  [[ "$REF" =~ $RELEASE_BRANCH_RE ]] &&
  [[ "$RELEASE_BRANCH_PRESETS" == *" $BUILD_PRESET "* ]]; then
  # Captured before the SHA check below, which runs its own =~ and would
  # otherwise overwrite BASH_REMATCH.
  RELEASE_BRANCH="${BASH_REMATCH[1]}"
  if [[ ! "$SHA" =~ ^[0-9a-f]{40}$ ]]; then
    # Failing beats publishing a tag nobody can map back to a commit.
    echo "Refusing to publish release-branch images from an unusable SHA: '$SHA'" >&2
    exit 1
  fi
  PLATFORM_ARG="--platform linux/arm64 --platform linux/amd64"
  PUSH_OR_LOAD="--push"
  # Left empty deliberately: supersetbot derives a branch tag only for
  # push/master, and handing it a release ref here would change which tags it
  # invents. The branch tag is injected through --extra-flags instead, the same
  # way the workflow's $IMAGE_TAG already is.
  BUILD_CONTEXT_REF=""
  # Commit-addressable only. This moves no tag an earlier push published, which
  # is why docker-publish-guard.sh still lets these builds through.
  RELEASE_BRANCH_TAG="${RELEASE_BRANCH}-${SHA:0:7}"
  # PUBLISH_DOCKER_CACHE stays empty: master owns the shared cache ref, so a
  # release branch reads those layers but never overwrites them.
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
emit RELEASE_BRANCH_TAG "$RELEASE_BRANCH_TAG"
