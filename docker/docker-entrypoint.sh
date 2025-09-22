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

# In dev mode with volume mounts, we need to ensure dependencies are installed
# BEFORE any Python code runs, as volumes override the image's site-packages
if [ "$DEV_MODE" == "true" ]; then
    if [ "$(whoami)" = "root" ] && command -v uv > /dev/null 2>&1; then
        echo "Dev mode detected. Ensuring critical dependencies are installed..."
        # Quick install of critical packages that are needed for imports
        uv pip install --no-cache-dir "pydantic>=2.8.0" "marshmallow-union" 2>/dev/null || true
    fi
fi

# Now run the actual bootstrap script
exec "$@"