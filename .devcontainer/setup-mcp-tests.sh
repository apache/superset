#!/bin/bash
# Setup script for MCP testing in GitHub Codespaces

set -e

echo "Setting up MCP test environment in Codespaces..."

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

source venv/bin/activate

# Install Superset and dependencies
echo "Installing Superset..."
pip install --upgrade pip setuptools wheel
pip install -e .
pip install -r requirements/testing.txt

# Install additional test dependencies
echo "Installing test dependencies..."
pip install anthropic requests pytest

# Initialize Superset
echo "Initializing Superset..."
export SUPERSET_CONFIG_PATH=/tmp/superset_config.py

cat > /tmp/superset_config.py << EOF
SECRET_KEY = 'codespaces-test-key'
SQLALCHEMY_DATABASE_URI = 'sqlite:////tmp/superset.db'

# Use simple cache for testing
CACHE_CONFIG = {
    'CACHE_TYPE': 'SimpleCache',
    'CACHE_DEFAULT_TIMEOUT': 300,
}

# MCP Settings
MCP_AUTH_ENABLED = False
SUPERSET_WEBSERVER_ADDRESS = "http://localhost:8088"
EOF

# Initialize database
superset db upgrade
superset fab create-admin --username admin --firstname Admin --lastname User --email admin@example.com --password admin || true
superset init

# Load example data
echo "Loading example data..."
superset load-examples --force --only-metadata || true

# Create startup script
cat > /workspace/start_mcp_tests.sh << 'SCRIPT'
#!/bin/bash
# Start services for MCP testing

echo "Starting Superset and MCP Service..."

# Kill any existing processes
pkill -f "superset run" || true
pkill -f "superset mcp" || true

# Start Superset
source /workspace/venv/bin/activate
export SUPERSET_CONFIG_PATH=/tmp/superset_config.py

superset run -p 8088 --with-threads --reload --debugger > /tmp/superset.log 2>&1 &
echo $! > /tmp/superset.pid

# Wait for Superset to start
echo "Waiting for Superset to start..."
for i in {1..30}; do
    if curl -f http://localhost:8088/health 2>/dev/null; then
        echo "Superset is ready!"
        break
    fi
    sleep 2
done

# Start MCP service
superset mcp run --port 5008 --debug > /tmp/mcp.log 2>&1 &
echo $! > /tmp/mcp.pid

echo "Services started!"
echo "Superset: http://localhost:8088 (admin/admin)"
echo "MCP Service: http://localhost:5008"
echo ""
echo "To run tests:"
echo "  cd superset/mcp_service"
echo "  python run_mcp_tests.py MCP_CHART_TEST_PLAN.md"
echo ""
echo "Logs:"
echo "  tail -f /tmp/superset.log"
echo "  tail -f /tmp/mcp.log"
SCRIPT

chmod +x /workspace/start_mcp_tests.sh

# Create Claude CLI wrapper (for when it's available)
cat > /workspace/venv/bin/claude << 'CLAUDE'
#!/usr/bin/env python3
"""
Claude CLI wrapper for testing
This is a mock implementation for CI testing
"""
import sys
import json
from datetime import datetime

# Mock response for testing
print(f"Claude CLI Mock - Timestamp: {datetime.now()}")
print("This is a mock response for CI testing")
print("In real usage, install the actual Claude CLI")
print(f"Prompt received: {' '.join(sys.argv[1:])}")

# Return success
sys.exit(0)
CLAUDE

chmod +x /workspace/venv/bin/claude

echo ""
echo "✅ MCP test environment setup complete!"
echo ""
echo "To start testing:"
echo "  ./start_mcp_tests.sh"
echo ""
echo "Available test plans:"
ls -1 superset/mcp_service/*.md | grep -E "(TEST_PLAN|TESTING_PLAN)" | sed 's/^/  - /'
