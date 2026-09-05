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
        echo "Running \"npm run prune\""
        npm run prune
    fi

    # `npm install` re-resolves and re-links the whole tree even when nothing
    # changed, which is slow and unnecessary on every container start. Skip it
    # when package.json/package-lock.json are unchanged since the last install
    # and node_modules is already present; set FORCE_NPM_INSTALL=true to opt out.
    NPM_LOCK_HASH_FILE="node_modules/.package-lock.hash"
    CURRENT_NPM_LOCK_HASH="$(cat package.json package-lock.json 2> /dev/null | sha256sum | cut -d' ' -f1)"

    if [ "$FORCE_NPM_INSTALL" = "true" ] \
        || [ ! -d "node_modules" ] \
        || [ ! -f "$NPM_LOCK_HASH_FILE" ] \
        || [ "$(cat "$NPM_LOCK_HASH_FILE")" != "$CURRENT_NPM_LOCK_HASH" ]; then
        echo "Running \"npm install\""
        npm install
        echo "$CURRENT_NPM_LOCK_HASH" > "$NPM_LOCK_HASH_FILE"
    else
        echo "package.json/package-lock.json unchanged, skipping \"npm install\" (set FORCE_NPM_INSTALL=true to override)"
    fi

    echo "Start webpack dev server"
    # start the webpack dev server, serving dynamically at http://localhost:9000
    # it proxies to the backend served at http://localhost:8088
    npm run dev-server

else
    echo "Skipping frontend build steps - YOU NEED TO RUN IT MANUALLY ON THE HOST!"
    echo "https://superset.apache.org/docs/contributing/development/#webpack-dev-server"
fi
