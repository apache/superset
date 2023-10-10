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
REPO_NAME="975226449092.dkr.ecr.ap-southeast-1.amazonaws.com/superset"
RELEASE_VERSION="alpha-0.0.1"

# if [[ "${GITHUB_EVENT_NAME}" == "pull_request" ]]; then
#   REFSPEC=$(echo "${GITHUB_HEAD_REF}" | sed 's/[^a-zA-Z0-9]/-/g' | head -c 40)
#   PR_NUM=$(echo "${GITHUB_REF}" | sed 's:refs/pull/::' | sed 's:/merge::')
#   LATEST_TAG="pr-${PR_NUM}"
# elif [[ "${GITHUB_EVENT_NAME}" == "release" ]]; then
#   REFSPEC=$(echo "${GITHUB_REF}" | sed 's:refs/tags/::' | head -c 40)
#   LATEST_TAG="${REFSPEC}"
# else
#   REFSPEC=$(echo "${GITHUB_REF}" | sed 's:refs/heads/::' | sed 's/[^a-zA-Z0-9]/-/g' | head -c 40)
#   LATEST_TAG="${REFSPEC}"
# fi

LATEST_TAG="${RELEASE_VERSION}"

cat<<EOF
  Rolling with tags:
  - ${REPO_NAME}:${LATEST_TAG}
EOF

#
# Build the "lean" image
#
docker build --target lean \
  -t "${REPO_NAME}:${LATEST_TAG}" \
  --label "sha=${SHA}" \
  --label "built_at=$(date)" \
  --label "target=lean" \
  .

#
# Build the "lean310" image
#
docker build --target lean \
  -t "${REPO_NAME}:${LATEST_TAG}-py310" \
  --build-arg PY_VER="3.10-slim-bookworm"\
  --label "sha=${SHA}" \
  --label "built_at=$(date)" \
  --label "target=lean310" \
  .

#
# Build the "websocket" image
#
# docker build \
#   -t "${REPO_NAME}:${LATEST_TAG}-websocket" \
#   --label "sha=${SHA}" \
#   --label "built_at=$(date)" \
#   --label "target=websocket" \
#   superset-websocket

#
# Build the dev image
#
# docker build --target dev \
#   -t "${REPO_NAME}:${LATEST_TAG}-dev" \
#   --label "sha=${SHA}" \
#   --label "built_at=$(date)" \
#   --label "target=dev" \
#  .

#
# Build the dockerize image
#
# docker build \
#   -t "${REPO_NAME}:dockerize" \
#   --label "sha=${SHA}" \
#   --label "built_at=$(date)" \
#   -f dockerize.Dockerfile \
#   .

aws ecr get-login-password --region ap-southeast-1 | docker login --username AWS --password-stdin 975226449092.dkr.ecr.ap-southeast-1.amazonaws.com
docker push --all-tags "${REPO_NAME}"
