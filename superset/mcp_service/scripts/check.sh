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

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "Checking MCP service setup..."
echo ""

# Check config file
if [ -f superset_config.py ]; then
    echo -e "${GREEN}✓ superset_config.py exists${NC}"
else
    echo -e "${RED}✗ superset_config.py missing${NC}"
fi

# Check configuration settings
if grep -q "SECRET_KEY" superset_config.py 2>/dev/null; then
    echo -e "${GREEN}✓ SECRET_KEY configured${NC}"
else
    echo -e "${RED}✗ SECRET_KEY not configured${NC}"
fi

if grep -q "ANTHROPIC_API_KEY" superset_config.py 2>/dev/null; then
    echo -e "${GREEN}✓ Anthropic API key configured${NC}"
else
    echo -e "${YELLOW}⚠ Anthropic API key not configured (MCP features limited)${NC}"
fi

if grep -q "SUPERSET_WEBSERVER_ADDRESS" superset_config.py 2>/dev/null; then
    echo -e "${GREEN}✓ SUPERSET_WEBSERVER_ADDRESS configured${NC}"
else
    echo -e "${YELLOW}⚠ Using default http://localhost:8088${NC}"
fi

# Check MCP service directory
if [ -d superset/mcp_service ]; then
    echo -e "${GREEN}✓ MCP service directory exists${NC}"
else
    echo -e "${RED}✗ MCP service directory missing${NC}"
fi

echo ""
echo "Checking if Superset is running..."

# Extract webserver address
WEBSERVER_ADDRESS=$(grep -oE "SUPERSET_WEBSERVER_ADDRESS\s*=\s*['\"]([^'\"]+)['\"]" superset_config.py 2>/dev/null | sed -E "s/.*['\"]([^'\"]+)['\"]/\1/" || echo "http://localhost:8088")

if curl -s -f "$WEBSERVER_ADDRESS/health" >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Superset is running at $WEBSERVER_ADDRESS${NC}"
else
    echo -e "${YELLOW}⚠ Superset is not running (start with: make flask-app)${NC}"
fi

echo ""
echo "To set up MCP service, run: make mcp-setup"
echo "To start MCP service, run: make mcp-run"
echo "To stop background Superset: make mcp-stop"
