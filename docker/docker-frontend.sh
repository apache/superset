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
set -e

# Packages needed for puppeteer:
if [ "$PUPPETEER_SKIP_CHROMIUM_DOWNLOAD" = "false" ]; then
    apt update
    apt install -y chromium
fi

if [ "$BUILD_SUPERSET_FRONTEND_IN_DOCKER" = "true" ]; then
    echo "Building Superset frontend in dev mode inside docker container"
    cd /app/superset-frontend

    if [ "$NPM_RUN_PRUNE" = "true" ]; then
        echo "Running `npm run prune`"
        npm run prune
    fi

    echo "Running `npm install`"
    npm install

    echo "Start webpack dev server"
    # start the webpack dev server, serving dynamically at http://localhost:9000
    # it proxies to the backend served at http://localhost:8088
    npm run dev-server

else
    echo "Skipping frontend build steps - YOU NEED TO RUN IT MANUALLY ON THE HOST!"
    echo "https://superset.apache.org/docs/contributing/development/#webpack-dev-server"
fi
