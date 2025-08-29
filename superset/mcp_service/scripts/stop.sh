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
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

if [ -f /tmp/superset-flask.pid ]; then
    echo "Stopping Superset started by mcp-run..."
    kill $(cat /tmp/superset-flask.pid) 2>/dev/null
    rm -f /tmp/superset-flask.pid
    echo -e "${GREEN}✓ Superset stopped${NC}"
else
    echo -e "${YELLOW}No Superset process started by mcp-run found${NC}"
fi
