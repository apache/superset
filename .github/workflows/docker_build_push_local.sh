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


REPO_NAME="setusuraj/superset"


REFSPEC="2.0.4"
LATEST_TAG="latest"

cat<<EOF
  Rolling with tags:
  - ${REPO_NAME}:${REFSPEC}
  - ${REPO_NAME}:${LATEST_TAG}
EOF

#
# Build the "lean" image
#
docker build --target lean \
  -t "${REPO_NAME}:${REFSPEC}" \
  -t "${REPO_NAME}:${LATEST_TAG}" \
  --build-arg PY_VER="3.8-slim"\
  --label "built_at=$(date)" \
  --label "target=lean" \
  .

#
# Build the "lean39" image
#
docker build --target lean \
  -t "${REPO_NAME}:${REFSPEC}-py39" \
  -t "${REPO_NAME}:${LATEST_TAG}-py39" \
  --build-arg PY_VER="3.9-slim"\
  --label "built_at=$(date)" \
  --label "target=lean39" \
  .

#
# Build the "websocket" image
#
docker build \
  -t "${REPO_NAME}:${REFSPEC}-websocket" \
  -t "${REPO_NAME}:${LATEST_TAG}-websocket" \
  --label "built_at=$(date)" \
  --label "target=websocket" \
  superset-websocket

#
# Build the dev image
#
docker build --target dev \
  -t "${REPO_NAME}:${REFSPEC}-dev" \
  -t "${REPO_NAME}:${LATEST_TAG}-dev" \
  --label "built_at=$(date)" \
  --label "target=dev" \
  .

if [ -z "${DOCKERHUB_TOKEN}" ]; then
  # Skip if secrets aren't populated -- they're only visible for actions running in the repo (not on forks)
  echo "Skipping Docker push"
else
  # Login and push
  docker logout
  docker login --username "${DOCKERHUB_USER}" --password "${DOCKERHUB_TOKEN}"
  docker push --all-tags "${REPO_NAME}"
fi
