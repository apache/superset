#!/usr/bin/env bash

set -eo pipefail

REPO_NAME="apache/incubator-superset"
REFSPEC="${GITHUB_HEAD_REF/[^a-zA-Z0-9]/-}"
LATEST_TAG=REFSPEC

if [[ "${GITHUB_EVENT_NAME}" == "pull_request" ]]; then
  PR_NUM=$(echo "${GITHUB_REF}" | sed 's:refs/pull/::' | sed 's:/merge::')
  LATEST_TAG="pr-${PR_NUM}"
elif [[ "${REFSPEC}" == "master" ]]; then
  LATEST_TAG="latest"
fi

cat<<EOF
  Rolling with tags:
  - ${REPO_NAME}:${GITHUB_SHA}
  - ${REPO_NAME}:${REFSPEC}
  - ${REPO_NAME}:${LATEST_TAG}
EOF

#
# Build the "lean" image
#
docker build --target lean \
  -t "${REPO_NAME}:${GITHUB_SHA}" \
  -t "${REPO_NAME}:${REFSPEC}" \
  -t "${REPO_NAME}:${LATEST_TAG}" \
  --label "sha=${GITHUB_SHA}" \
  --label "built_at=$(date)" \
  --label "target=lean" \
  --label "build_actor=${GITHUB_ACTOR}"

#
# Build the dev image
#
docker build --target dev \
  -t "${REPO_NAME}:${GITHUB_SHA}-dev" \
  -t "${REPO_NAME}:${REFSPEC}-dev" \
  -t "${REPO_NAME}:${LATEST_TAG}-dev" \
  --label "sha=${GITHUB_SHA}" \
  --label "built_at=$(date)" \
  --label "target=dev" \
  --label "build_actor=${GITHUB_ACTOR}"

# Login and push
docker login -u "${DOCKERHUB_USER}" -p "${DOCKERHUB_TOKEN}"
docker push "${REPO_NAME}"
