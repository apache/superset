#!/bin/bash
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
set -e

if [ -z "${SUPERSET_VERSION_RC}" ] || [ -z "${SUPERSET_SVN_DEV_PATH}" ] || [ -z "${SUPERSET_VERSION}" ]; then
  echo "SUPERSET_VERSION_RC, SUPERSET_SVN_DEV_PATH and SUPERSET_VERSION are required to run this container"
  exit 1
fi

SUPERSET_RELEASE_RC=apache-superset-incubating-"${SUPERSET_VERSION_RC}"
SUPERSET_RELEASE_RC_TARBALL="${SUPERSET_RELEASE_RC}"-source.tar.gz
SUPERSET_RELEASE_RC_BASE_PATH="${SUPERSET_SVN_DEV_PATH}"/"${SUPERSET_VERSION_RC}"
SUPERSET_RELEASE_RC_TARBALL_PATH="${SUPERSET_RELEASE_RC_BASE_PATH}"/"${SUPERSET_RELEASE_RC_TARBALL}"

# Create directory release version
mkdir -p "${SUPERSET_SVN_DEV_PATH}"/"${SUPERSET_VERSION_RC}"

# Clone superset from tag to /tmp
cd /tmp
git clone --depth 1 --branch ${SUPERSET_VERSION_RC} https://github.com/apache/incubator-superset.git
mkdir -p "${HOME}/${SUPERSET_VERSION_RC}"
cd incubator-superset && \

# Check RC version
if ! jq -e --arg SUPERSET_VERSION $SUPERSET_VERSION '.version == $SUPERSET_VERSION' superset-frontend/package.json
then
  SOURCE_VERSION=$(jq '.version' superset-frontend/package.json)
  echo "Source package.json version is wrong, found: ${SOURCE_VERSION} should be: ${SUPERSET_VERSION}"
  exit 1
fi

# Create source tarball
git archive \
    --format=tar.gz "${SUPERSET_VERSION_RC}" \
    --prefix="${SUPERSET_RELEASE_RC}/" \
    -o "${SUPERSET_RELEASE_RC_TARBALL_PATH}"

chown -R ${HOST_UID}:${HOST_UID} "${SUPERSET_RELEASE_RC_BASE_PATH}"
