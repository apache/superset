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

SHA=$(git rev-parse HEAD)
REPO_NAME="apache/superset"


if [[ "${REFSPEC}" == "master" ]]; then
  LATEST_TAG="latest"
fi

cat<<EOF
  Rolling with tags:
  - ${REPO_NAME}:${SHA}
  - ${REPO_NAME}:${REFSPEC}
  - ${REPO_NAME}:${LATEST_TAG}
EOF

#
# Build the "lean" image
#
DOCKER_BUILDKIT=1 docker buildx  build --target lean \
  -t "${REPO_NAME}:${SHA}" \
  --platform linux/arm64/v8
  --label "sha=${SHA}" \
  --label "built_at=$(date)" \
  --label "target=lean" \
  --label "build_actor=${GITHUB_ACTOR}" \
  .

#
# Build the "lean310" image
#
DOCKER_BUILDKIT=1 docker buildx build --target lean \
  -t "${REPO_NAME}:${SHA}-py310" \
  -t "${REPO_NAME}:${REFSPEC}-py310" \
  -t "${REPO_NAME}:${LATEST_TAG}-py310" \
  --build-arg PY_VER="3.10-slim"\
  --label "sha=${SHA}" \
  --platform linux/arm64/v8
  --label "built_at=$(date)" \
  --label "target=lean310" \
  --label "build_actor=${GITHUB_ACTOR}" \
  .

#
# Build the "websocket" image
#
DOCKER_BUILDKIT=1 docker buildx build \
  -t "${REPO_NAME}:${SHA}-websocket" \
  -t "${REPO_NAME}:${REFSPEC}-websocket" \
  -t "${REPO_NAME}:${LATEST_TAG}-websocket" \
  --label "sha=${SHA}" \
  --platform linux/arm64/v8
  --label "built_at=$(date)" \
  --label "target=websocket" \
  --label "build_actor=${GITHUB_ACTOR}" \
  superset-websocket

#
# Build the dev image
#
DOCKER_BUILDKIT=1 docker buildx build --target dev \
  -t "${REPO_NAME}:${SHA}-dev" \
  -t "${REPO_NAME}:${REFSPEC}-dev" \
  -t "${REPO_NAME}:${LATEST_TAG}-dev" \
  --label "sha=${SHA}" \
  --platform linux/arm64/v8
  --label "built_at=$(date)" \
  --label "target=dev" \
  --label "build_actor=${GITHUB_ACTOR}" \
  .

#
# Build the dockerize image
#
DOCKER_BUILDKIT=1 docker buildx build \
  -t "${REPO_NAME}:dockerize" \
  --label "sha=${SHA}" \
  --label "built_at=$(date)" \
  --label "build_actor=${GITHUB_ACTOR}" \
  -f dockerize.Dockerfile \
  .
