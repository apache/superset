#!/bin/bash

## use in claude like this
#    "Superset MCP": {
#      "command": "~/github/superset/superset/mcp_service/run_proxy_auth.sh",
#      "args": [],
#      "env": {
#        "SUPERSET_MCP_TOKEN": "your_jwt_token_here"
#      }
#    },

# Get auth token from environment or file
if [ -f ~/.superset_mcp_token ]; then
    export SUPERSET_MCP_TOKEN=$(cat ~/.superset_mcp_token)
    echo "Using token from ~/.superset_mcp_token" >&2
elif [ -z "$SUPERSET_MCP_TOKEN" ]; then
    echo "Warning: No authentication token found. Set SUPERSET_MCP_TOKEN or create ~/.superset_mcp_token" >&2
    echo "Generate token with: python generate_dev_token.py --save" >&2
fi

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

# Run the authenticated proxy (v2 - direct service call)
"$PYTHON_PATH" "$SCRIPT_DIR/simple_proxy_auth.py"
