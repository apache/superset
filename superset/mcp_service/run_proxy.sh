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

## use in claude like this
#    "Superset MCP Proxy": {
#      "command": "~/github/superset/superset/mcp_service/run_proxy.sh",
#      "args": [],
#      "env": {}
#    },

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Get the project root (two levels up from mcp_service)
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Use python from the virtual environment if it exists, otherwise use system python
if [ -f "$PROJECT_ROOT/venv/bin/python" ]; then
    PYTHON_PATH="$PROJECT_ROOT/venv/bin/python"
elif [ -f "$PROJECT_ROOT/.venv/bin/python" ]; then
    PYTHON_PATH="$PROJECT_ROOT/.venv/bin/python"
else
    PYTHON_PATH="python3"
fi

# Run the proxy script
"$PYTHON_PATH" "$SCRIPT_DIR/simple_proxy.py"
