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
set -eo pipefail

GITHUB_RELEASE_TAG_NAME="$1"
TARGET="$2"
BUILD_PLATFORM="$3" # should be either 'linux/amd64' or 'linux/arm64'

# Common variables
SHA=$(git rev-parse HEAD)
REPO_NAME="apache/superset"
DOCKER_ARGS="--load" # default args, change as needed
DOCKER_CONTEXT="."


if [[ "${GITHUB_EVENT_NAME}" == "pull_request" ]]; then
  REFSPEC=$(echo "${GITHUB_HEAD_REF}" | sed 's/[^a-zA-Z0-9]/-/g' | head -c 40)
  PR_NUM=$(echo "${GITHUB_REF}" | sed 's:refs/pull/::' | sed 's:/merge::')
  LATEST_TAG="pr-${PR_NUM}"
elif [[ "${GITHUB_EVENT_NAME}" == "release" ]]; then
  REFSPEC=$(echo "${GITHUB_REF}" | sed 's:refs/tags/::' | head -c 40)
  LATEST_TAG="${REFSPEC}"
else
  REFSPEC=$(echo "${GITHUB_REF}" | sed 's:refs/heads/::' | sed 's/[^a-zA-Z0-9]/-/g' | head -c 40)
  LATEST_TAG="${REFSPEC}"
fi


if [[ "${REFSPEC}" == "master" ]]; then
  LATEST_TAG="master"
fi

# get the latest release tag
if [ -n "${GITHUB_RELEASE_TAG_NAME}" ]; then
  output=$(source ./scripts/tag_latest_release.sh "${GITHUB_RELEASE_TAG_NAME}" --dry-run) || true
  SKIP_TAG=$(echo "${output}" | grep "SKIP_TAG" | cut -d'=' -f2)
  if [[ "${SKIP_TAG}" == "SKIP_TAG::false" ]]; then
    LATEST_TAG="latest"
  fi
fi

if [[ "${TEST_ENV}" == "true" ]]; then
  # don't run the build in test environment
  echo "LATEST_TAG is ${LATEST_TAG}"
  exit 0
fi

# for the dev image, it's ok to tag master as latest-dev
# for production, we only want to tag the latest official release as latest
if [ "${LATEST_TAG}" = "master" ]; then
  DEV_TAG="${REPO_NAME}:latest-dev"
else
  DEV_TAG="${REPO_NAME}:${LATEST_TAG}-dev"
fi

BUILD_ARG="3.9-slim-bookworm"

case "${TARGET}" in
  "dev")
    DOCKER_TAGS="-t ${REPO_NAME}:${SHA}-dev -t ${REPO_NAME}:${REFSPEC}-dev -t ${DEV_TAG}"
    BUILD_TARGET="dev"
    ;;
  "lean")
    DOCKER_TAGS="-t ${REPO_NAME}:${SHA} -t ${REPO_NAME}:${REFSPEC} -t ${REPO_NAME}:${LATEST_TAG}"
    BUILD_TARGET="lean"
    ;;
  "lean310")
    DOCKER_TAGS="-t ${REPO_NAME}:${SHA}-py310 -t ${REPO_NAME}:${REFSPEC}-py310 -t ${REPO_NAME}:${LATEST_TAG}-py310"
    BUILD_TARGET="lean"
    BUILD_ARG="3.10-slim-bookworm"
    ;;
  "websocket")
    DOCKER_TAGS="-t ${REPO_NAME}:${SHA}-websocket -t ${REPO_NAME}:${REFSPEC}-websocket -t ${REPO_NAME}:${LATEST_TAG}-websocket"
    BUILD_TARGET=""
	DOCKER_CONTEXT="superset-websocket"
    ;;
  "dockerize")
    DOCKER_TAGS="-t ${REPO_NAME}:dockerize"
    BUILD_TARGET=""
	DOCKER_CONTEXT="-f dockerize.Dockerfile ."
    ;;
  *)
    echo "Invalid TARGET: ${TARGET}"
    exit 1
    ;;
esac

cat<<EOF
  Rolling with tags:
  - ${REPO_NAME}:${SHA}
  - ${REPO_NAME}:${REFSPEC}
  - ${REPO_NAME}:${LATEST_TAG}
EOF

if [ -z "${DOCKERHUB_TOKEN}" ]; then
  # Skip if secrets aren't populated -- they're only visible for actions running in the repo (not on forks)
  echo "Skipping Docker push"
  # By default load it back
  DOCKER_ARGS="--load"
else
  # Login and push
  docker logout
  docker login --username "${DOCKERHUB_USER}" --password "${DOCKERHUB_TOKEN}"
  DOCKER_ARGS="--push"
fi
set -x

TARGET_ARGUMENT=""
if [[ -n "${BUILD_TARGET}" ]]; then
  TARGET_ARGUMENT="--target ${BUILD_TARGET}"
fi

docker buildx build \
  ${TARGET_ARGUMENT} \
  ${DOCKER_ARGS} \
  --cache-from=type=registry,ref=apache/superset:${TARGET} \
  --cache-to=type=registry,mode=max,ref=apache/superset:${TARGET} \
  ${DOCKER_TAGS} \
  --platform ${BUILD_PLATFORM} \
  --label "sha=${SHA}" \
  --label "built_at=$(date)" \
  --label "target=${TARGET}" \
  --label "base=${PY_VER}" \
  --label "build_actor=${GITHUB_ACTOR}" \
  ${BUILD_ARG:+--build-arg PY_VER="${BUILD_ARG}"} \
  ${DOCKER_CONTEXT}
