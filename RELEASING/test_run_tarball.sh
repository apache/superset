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

if [ -z "${SUPERSET_VERSION_RC}" ]; then
  echo "SUPERSET_VERSION_RC is required to run this container"
  exit 1
fi

# Building a docker from a tarball
docker build --no-cache -t apache-superset:${SUPERSET_VERSION_RC} -f Dockerfile.from_tarball . --build-arg VERSION=${SUPERSET_VERSION_RC}

echo "---------------------------------------------------"
echo "After docker build and run, you should be able to access localhost:5001 on your browser"
echo "login using admin/admin"
echo "---------------------------------------------------"
if ! docker run -p 5001:8088 apache-superset:${SUPERSET_VERSION_RC}; then
  echo "---------------------------------------------------"
  echo "[ERROR] Seems like this apache-superset:${SUPERSET_VERSION_RC} has a setup/startup problem!"
  echo "---------------------------------------------------"
fi
