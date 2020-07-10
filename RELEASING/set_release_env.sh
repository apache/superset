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
usage() {
   echo "usage (BASH): . set_release_env.sh <SUPERSET_RC_VERSION> <PGP_KEY_FULLNAME>"
   echo "usage (ZSH): source set_release_env.sh <SUPERSET_RC_VERSION> <PGP_KEY_FULLNAME>"
   echo
   echo "example: source set_release_env.sh 0.37.0rc1 myid@apache.org"
}

if [ -z "$1" ] || [ -z "$2" ]; then
  usage;
else
  if [[ ${1} =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)rc([0-9]+)$ ]]; then
    if [ -n "$ZSH_VERSION" ]; then
      VERSION_MAJOR="${match[1]}"
      VERSION_MINOR="${match[2]}"
      VERSION_PATCH="${match[3]}"
      VERSION_RC="${match[4]}"
    elif [ -n "$BASH_VERSION" ]; then
      VERSION_MAJOR="${BASH_REMATCH[1]}"
      VERSION_MINOR="${BASH_REMATCH[2]}"
      VERSION_PATCH="${BASH_REMATCH[3]}"
      VERSION_RC="${BASH_REMATCH[4]}"
    else
      echo "Unsupported shell type, only zsh and bash supported"
      exit 1
    fi

  else
    echo "unable to parse version string ${1}. Example of valid version string: 0.35.2rc1"
    exit 1
  fi
  export SUPERSET_VERSION="${VERSION_MAJOR}.${VERSION_MINOR}.${VERSION_PATCH}"
  export SUPERSET_RC="${VERSION_RC}"
  export SUPERSET_GITHUB_BRANCH="${VERSION_MAJOR}.${VERSION_MINOR}"
  export SUPERSET_PGP_FULLNAME="${2}"
  export SUPERSET_VERSION_RC="${SUPERSET_VERSION}rc${VERSION_RC}"
  export SUPERSET_RELEASE=apache-superset-incubating-"${SUPERSET_VERSION}"
  export SUPERSET_RELEASE_RC=apache-superset-incubating-"${SUPERSET_VERSION_RC}"
  export SUPERSET_RELEASE_TARBALL="${SUPERSET_RELEASE}"-source.tar.gz
  export SUPERSET_RELEASE_RC_TARBALL="${SUPERSET_RELEASE_RC}"-source.tar.gz
  export SUPERSET_TMP_ASF_SITE_PATH="/tmp/incubator-superset-site-${SUPERSET_VERSION}"

  echo -------------------------------
  echo Set Release env variables
  env | grep ^SUPERSET_
  echo -------------------------------
fi
