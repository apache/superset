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
   echo "usage: . set_release_env.sh <SUPERSET_VERSION> <SUPERSET_RC> <PGP_KEY_FULLBANE>"
}

if [ -z "$1" ] || [ -z "$2" ] || [ -z "$3" ]; then
  usage;
else
  export SUPERSET_VERSION="${1}"
  export SUPERSET_RC="${2}"
  export SUPERSET_PGP_FULLNAME="${3}"
  export SUPERSET_VERSION_RC="${SUPERSET_VERSION}rc${SUPERSET_RC}"
  export SUPERSET_RELEASE=apache-superset-incubating-"${SUPERSET_VERSION}"
  export SUPERSET_RELEASE_RC=apache-superset-incubating-"${SUPERSET_VERSION_RC}"
  export SUPERSET_RELEASE_TARBALL="${SUPERSET_RELEASE}"-source.tar.gz
  export SUPERSET_RELEASE_RC_TARBALL="${SUPERSET_RELEASE_RC}"-source.tar.gz
  export SUPERSET_TMP_ASF_SITE_PATH="/tmp/incubator-superset-site-${SUPERSET_VERSION}"

  echo -------------------------------
  echo Set Release env variables
  env | grep SUPERSET
  echo -------------------------------
fi
