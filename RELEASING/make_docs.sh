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

DOCKER_TMP_ASF_SITE_PATH=/asf-site
DOC_SITE_PORT=5002

# Clean tmp dir
if [[ -d "${SUPERSET_TMP_ASF_SITE_PATH}" ]]; then
  rm -rf "${SUPERSET_TMP_ASF_SITE_PATH}"
fi
mkdir -p "${SUPERSET_TMP_ASF_SITE_PATH}"

# Building docker that will help update superset asf-site
docker build --no-cache -t apache-docs \
       --build-arg VERSION="${SUPERSET_VERSION}" \
       -f Dockerfile.make_docs .

# Running docker to update superset asf-site
docker run \
      -v "${SUPERSET_TMP_ASF_SITE_PATH}":"${DOCKER_TMP_ASF_SITE_PATH}":rw \
      -e HOST_UID=${UID} \
      -p ${DOC_SITE_PORT}:8000 \
      -d \
      -ti apache-docs

RESULT=$?
if [ $RESULT -ne 0 ]; then
  echo Updating and launching documentation site failed
  echo tip: Check if other container is using port:$DOC_SITE_PORT
  exit 1
fi

echo "---------------------------------------------------"
echo Superset documentation site is ready at http://localhost:5002
echo Check it out and if all looks good:
echo $ cd "${SUPERSET_TMP_ASF_SITE_PATH}"
echo $ git add .
echo $ git commit -a -m \"New doc version "${SUPERSET_VERSION}"\"
echo $ git push origin asf-site
