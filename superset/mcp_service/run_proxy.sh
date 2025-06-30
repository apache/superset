#!/bin/bash

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
