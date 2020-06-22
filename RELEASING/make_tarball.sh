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

usage() {
   echo "usage: make_tarball.sh <SUPERSET_VERSION> <SUPERSET_RC> <PGP_KEY_FULLBANE>"
}

if [ -z "$1" ] || [ -z "$2" ] || [ -z "$3" ]; then
  if [ -z "${SUPERSET_VERSION}" ] || [ -z "${SUPERSET_RC}" ] || [ -z "${SUPERSET_PGP_FULLNAME}" ] || [ -z "${SUPERSET_RELEASE_RC_TARBALL}" ]; then
    echo "No parameters found and no required environment variables set"
    echo "usage: make_tarball.sh <SUPERSET_VERSION> <SUPERSET_RC> <PGP_KEY_FULLBANE>"
    usage;
    exit 1
  fi
else
  SUPERSET_VERSION="${1}"
  SUPERSET_RC="${2}"
  SUPERSET_PGP_FULLNAME="${3}"
  SUPERSET_RELEASE_RC_TARBALL="apache-superset-incubating-${SUPERSET_VERSION_RC}-source.tar.gz"
fi

SUPERSET_VERSION_RC="${SUPERSET_VERSION}rc${SUPERSET_RC}"

if [ -z "${SUPERSET_SVN_DEV_PATH}" ]; then
  SUPERSET_SVN_DEV_PATH="$HOME/svn/superset_dev"
fi

if [[ ! -d "${SUPERSET_SVN_DEV_PATH}" ]]; then
  echo "${SUPERSET_SVN_DEV_PATH} does not exist, you need to: svn checkout"
  exit 1
fi

if [ -d "${SUPERSET_SVN_DEV_PATH}/${SUPERSET_VERSION_RC}" ]; then
  echo "${SUPERSET_VERSION_RC} Already exists on svn, refusing to overwrite"
  exit 1
fi

SUPERSET_RELEASE_RC_TARBALL_PATH="${SUPERSET_SVN_DEV_PATH}"/"${SUPERSET_VERSION_RC}"/"${SUPERSET_RELEASE_RC_TARBALL}"
DOCKER_SVN_PATH="/docker_svn"

# Building docker that will produce a tarball
docker build -t apache-builder -f Dockerfile.make_tarball .

# Running docker to produce a tarball
docker run \
      -e SUPERSET_SVN_DEV_PATH="${DOCKER_SVN_PATH}" \
      -e SUPERSET_VERSION="${SUPERSET_VERSION}" \
      -e SUPERSET_VERSION_RC="${SUPERSET_VERSION_RC}" \
      -e HOST_UID=${UID} \
      -v "${SUPERSET_SVN_DEV_PATH}":"${DOCKER_SVN_PATH}":rw \
      -ti apache-builder

gpg --armor --local-user "${SUPERSET_PGP_FULLNAME}" --output "${SUPERSET_RELEASE_RC_TARBALL_PATH}".asc --detach-sig "${SUPERSET_RELEASE_RC_TARBALL_PATH}"
gpg --print-md --local-user "${SUPERSET_PGP_FULLNAME}" SHA512 "${SUPERSET_RELEASE_RC_TARBALL_PATH}" > "${SUPERSET_RELEASE_RC_TARBALL_PATH}".sha512

echo ---------------------------------------
echo Release candidate tarball is ready
echo ---------------------------------------
