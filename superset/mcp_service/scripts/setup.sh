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

echo -e "${GREEN}=== MCP Service Setup ===${NC}"

# Install Python dependencies
echo "Installing Python dependencies..."
pip install -r requirements/development.txt
pip install -e .
echo -e "${GREEN}✓ Python dependencies installed${NC}"

# Check and initialize database
if ! superset db current 2>/dev/null | grep -q "head"; then
    echo "Initializing database..."
    superset db upgrade
    superset init
    echo -e "${GREEN}✓ Database initialized${NC}"
else
    echo -e "${GREEN}✓ Database already initialized${NC}"
fi

# Install frontend dependencies
if [ ! -d "superset-frontend/node_modules" ]; then
    echo "Installing frontend dependencies..."
    cd superset-frontend && npm ci && cd ..
    echo -e "${GREEN}✓ Frontend dependencies installed${NC}"
else
    echo -e "${GREEN}✓ Frontend dependencies already installed${NC}"
fi

# Build frontend assets
echo "Building frontend assets..."
cd superset-frontend && npm run build && cd ..
echo -e "${GREEN}✓ Frontend assets built${NC}"

# Run MCP setup command
echo "Running MCP setup..."
superset mcp setup "$@"
