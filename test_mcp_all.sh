#!/bin/bash

# Complete MCP Testing Script - All in One

echo "====================================="
echo "     MCP SERVICE TEST SUITE"
echo "====================================="

# Initialize session once
echo -e "\n1️⃣ INITIALIZING SESSION..."
SESSION=$(curl -sD - -X POST http://localhost:5008/mcp/ \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test-suite","version":"1.0.0"}},"id":1}' \
  | grep -i "mcp-session-id:" | sed 's/.*: //' | tr -d '\r\n')

echo "Session ID: $SESSION"

# Send initialized notification
curl -s -X POST http://localhost:5008/mcp/ \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Mcp-Session-Id: $SESSION" \
  -d '{"jsonrpc":"2.0","method":"notifications/initialized"}' > /dev/null

# TEST 1: List Tools
echo -e "\n2️⃣ LISTING AVAILABLE TOOLS..."
echo "--------------------------------"
curl -s -X POST http://localhost:5008/mcp/ \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Mcp-Session-Id: $SESSION" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":2}' \
  | sed -n 's/^data: //p' | jq -r '.result.tools | length as $count | "\($count) tools available", (.[:5] | .[] | "  • \(.name)")'

# TEST 2: Call list_datasets
echo -e "\n3️⃣ CALLING list_datasets TOOL..."
echo "--------------------------------"
RESPONSE=$(curl -s -X POST http://localhost:5008/mcp/ \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Mcp-Session-Id: $SESSION" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "list_datasets",
      "arguments": {
        "request": {
          "page": 1,
          "page_size": 3
        }
      }
    },
    "id": 3
  }')

# Parse datasets from response
echo "$RESPONSE" | grep "^data: " | tail -1 | sed 's/^data: //' | jq -r '
  if .result.structuredContent.datasets then
    "Found \(.result.structuredContent.total_count) datasets (showing 3):",
    (.result.structuredContent.datasets[] |
      "  • \(.table_name) [\(.schema)] - \(.changed_on_humanized)"
    )
  else
    "No datasets found or error"
  end'

# TEST 3: Call get_superset_instance_info
echo -e "\n4️⃣ GETTING INSTANCE INFO..."
echo "--------------------------------"
RESPONSE=$(curl -s -X POST http://localhost:5008/mcp/ \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Mcp-Session-Id: $SESSION" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "get_superset_instance_info",
      "arguments": {
        "request": {}
      }
    },
    "id": 4
  }')

# Parse instance info
echo "$RESPONSE" | grep "^data: " | tail -1 | sed 's/^data: //' | jq -r '
  if .result.structuredContent.instance_summary then
    .result.structuredContent.instance_summary |
    "Superset Instance:",
    "• Dashboards: \(.total_dashboards)",
    "• Charts: \(.total_charts)",
    "• Datasets: \(.total_datasets)",
    "• Databases: \(.total_databases)",
    "• Users: \(.total_users)"
  else
    "Could not retrieve instance info"
  end'

echo -e "\n====================================="
echo "✅ All tests completed!"
echo "====================================="
