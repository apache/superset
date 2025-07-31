#!/bin/bash
# Script to help setup Claude Desktop for MCP testing

echo "Claude Desktop MCP Configuration Helper"
echo "======================================"
echo ""

# Find Claude Desktop config
CONFIG_PATH="$HOME/Library/Application Support/Claude/claude_desktop_config.json"

if [ ! -f "$CONFIG_PATH" ]; then
    echo "Creating Claude Desktop config directory..."
    mkdir -p "$HOME/Library/Application Support/Claude"
    echo '{}' > "$CONFIG_PATH"
fi

# Get the current directory
SUPERSET_PATH=$(cd "$(dirname "$0")/../../.." && pwd)
PROXY_PATH="$SUPERSET_PATH/superset/mcp_service/run_proxy.sh"

echo "Your Superset path: $SUPERSET_PATH"
echo "Proxy script path: $PROXY_PATH"
echo ""

# Check if proxy script exists
if [ ! -f "$PROXY_PATH" ]; then
    echo "ERROR: Proxy script not found at $PROXY_PATH"
    exit 1
fi

# Make proxy executable
chmod +x "$PROXY_PATH"

echo "Add this to your Claude Desktop config at:"
echo "$CONFIG_PATH"
echo ""
echo "{"
echo '  "mcpServers": {'
echo '    "superset-mcp": {'
echo "      \"command\": \"$PROXY_PATH\","
echo '      "args": [],'
echo '      "env": {}'
echo '    }'
echo '  }'
echo "}"
echo ""
echo "After adding this configuration:"
echo "1. Save the file"
echo "2. Restart Claude Desktop completely"
echo "3. In Claude Desktop, you should see 'superset-mcp' in the MCP servers"
echo "4. Then Claude CLI will also have access to the tools"
echo ""
echo "To test if it's working, try in Claude Desktop:"
echo "  'List all charts using MCP tools'"
