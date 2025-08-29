#!/bin/bash
# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Ensure PYTHONPATH includes current directory so superset_config.py is loaded
export PYTHONPATH="${PYTHONPATH:+$PYTHONPATH:}."

# Extract webserver address from config
WEBSERVER_ADDRESS=$(grep -oE "SUPERSET_WEBSERVER_ADDRESS\s*=\s*['\"]([^'\"]+)['\"]" superset_config.py 2>/dev/null | sed -E "s/.*['\"]([^'\"]+)['\"]/\1/" || echo "http://localhost:8088")

echo "Checking if Superset is running..."

if curl -s -f "$WEBSERVER_ADDRESS/health" >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Superset is running at $WEBSERVER_ADDRESS${NC}"
    echo "Starting MCP service..."
    superset mcp run "$@"
else
    echo -e "${YELLOW}⚠ Superset is not running at $WEBSERVER_ADDRESS${NC}"
    echo ""
    read -p "Would you like to start Superset? (y/N) " -n 1 -r
    echo ""

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Starting Superset in the background..."
        nohup flask run -p 8088 --with-threads --reload --debugger > /tmp/superset-flask.log 2>&1 &
        echo $! > /tmp/superset-flask.pid

        echo "Waiting for Superset to start..."
        for i in {1..30}; do
            if curl -s -f "$WEBSERVER_ADDRESS/health" >/dev/null 2>&1; then
                echo -e "${GREEN}✓ Superset started successfully!${NC}"
                echo "Starting MCP service..."
                superset mcp run "$@"
                exit 0
            fi
            printf "."
            sleep 1
        done

        echo ""
        echo -e "${RED}✗ Superset failed to start. Check /tmp/superset-flask.log for details.${NC}"
        exit 1
    else
        echo "Please start Superset manually with: make flask-app"
        exit 1
    fi
fi
