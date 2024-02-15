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

SHA=$(git rev-parse HEAD)
REPO_NAME=${2:-apache/superset}
REGISTRY_URL=${3}

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
  ARCHITECTURE_FOR_BUILD="linux/amd64"
else
  # Login and push
  docker logout
  docker login "${REGISTRY_URL}" --username "${DOCKERHUB_USER}" --password "${DOCKERHUB_TOKEN}"
  DOCKER_ARGS="--push"
  ARCHITECTURE_FOR_BUILD="linux/amd64"
fi
set -x

# for the dev image, it's ok to tag master as latest-dev
# for production, we only want to tag the latest official release as latest
if [ "${LATEST_TAG}" = "master" ]; then
  DEV_TAG="${REPO_NAME}:latest-dev"
else
  DEV_TAG="${REPO_NAME}:${LATEST_TAG}-dev"
fi

#
# Build the dev image
#
docker buildx build --target dev \
  $DOCKER_ARGS \
  --cache-from=type=registry,ref=apache/superset:master-dev \
  --cache-from=type=local,src=/tmp/superset \
  --cache-to=type=local,ignore-error=true,dest=/tmp/superset \
  -t "${REPO_NAME}:${SHA}-dev" \
  -t "${REPO_NAME}:${REFSPEC}-dev" \
  -t "${DEV_TAG}" \
  --platform linux/amd64 \
  --label "sha=${SHA}" \
  --label "built_at=$(date)" \
  --label "target=dev" \
  --label "build_actor=${GITHUB_ACTOR}" \
  .

#
# Build the "lean" image
#
docker buildx build --target lean \
  $DOCKER_ARGS \
  --cache-from=type=local,src=/tmp/superset \
  --cache-to=type=local,ignore-error=true,dest=/tmp/superset \
  -t "${REPO_NAME}:${SHA}" \
  -t "${REPO_NAME}:${REFSPEC}" \
  -t "${REPO_NAME}:${LATEST_TAG}" \
  --platform linux/amd64 \
  --label "sha=${SHA}" \
  --label "built_at=$(date)" \
  --label "target=lean" \
  --label "build_actor=${GITHUB_ACTOR}" \
  .

# #
# # Build the "lean310" image
# #
# docker buildx build --target lean \
#   $DOCKER_ARGS \
#   --cache-from=type=local,src=/tmp/superset \
#   --cache-to=type=local,ignore-error=true,dest=/tmp/superset \
#   -t "${REPO_NAME}:${SHA}-py310" \
#   -t "${REPO_NAME}:${REFSPEC}-py310" \
#   -t "${REPO_NAME}:${LATEST_TAG}-py310" \
#   --platform linux/amd64 \
#   --build-arg PY_VER="3.10-slim-bookworm"\
#   --label "sha=${SHA}" \
#   --label "built_at=$(date)" \
#   --label "target=lean310" \
#   --label "build_actor=${GITHUB_ACTOR}" \
#   .

# #
# # Build the "lean39" image
# #
# docker buildx build --target lean \
#   $DOCKER_ARGS \
#   --cache-from=type=local,src=/tmp/superset \
#   --cache-to=type=local,ignore-error=true,dest=/tmp/superset \
#   -t "${REPO_NAME}:${SHA}-py39" \
#   -t "${REPO_NAME}:${REFSPEC}-py39" \
#   -t "${REPO_NAME}:${LATEST_TAG}-py39" \
#   --platform linux/amd64 \
#   --build-arg PY_VER="3.9-slim-bullseye"\
#   --label "sha=${SHA}" \
#   --label "built_at=$(date)" \
#   --label "target=lean39" \
#   --label "build_actor=${GITHUB_ACTOR}" \
#   .


for BUILD_PLATFORM in $ARCHITECTURE_FOR_BUILD; do
# #
# # Build the "websocket" image
# #
# docker buildx build \
#   $DOCKER_ARGS \
#   --cache-from=type=registry,ref=apache/superset:master-websocket \
#   -t "${REPO_NAME}:${SHA}-websocket" \
#   -t "${REPO_NAME}:${REFSPEC}-websocket" \
#   -t "${REPO_NAME}:${LATEST_TAG}-websocket" \
#   --platform ${BUILD_PLATFORM} \
#   --label "sha=${SHA}" \
#   --label "built_at=$(date)" \
#   --label "target=websocket" \
#   --label "build_actor=${GITHUB_ACTOR}" \
#   superset-websocket

#
# Build the dockerize image
#
docker buildx build \
  $DOCKER_ARGS \
  --cache-from=type=registry,ref=apache/superset:dockerize \
  -t "${REPO_NAME}:dockerize" \
  --platform ${BUILD_PLATFORM} \
  --label "sha=${SHA}" \
  --label "built_at=$(date)" \
  --label "build_actor=${GITHUB_ACTOR}" \
  -f dockerize.Dockerfile \
  .
done
