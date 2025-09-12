#!/bin/bash

# Test MCP Native Proxy Endpoints - Mirror of test_mcp_all.sh but through Superset Native proxy

echo "====================================="
echo "  SUPERSET MCP NATIVE PROXY TEST SUITE"
echo "====================================="

SUPERSET_URL="http://localhost:9001"
MCP_PROXY_URL="${SUPERSET_URL}/api/v1/mcp-native/"

# Initialize session once
echo -e "\n1️⃣ INITIALIZING SESSION via NATIVE PROXY..."
SESSION=$(curl -sD - -X POST ${MCP_PROXY_URL} \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test-suite","version":"1.0.0"}},"id":1}' \
  | grep -i "mcp-session-id:" | head -1 | sed 's/.*: //' | tr -d '\r\n')

echo "Session ID: $SESSION"

# Send initialized notification
curl -s -X POST ${MCP_PROXY_URL} \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Mcp-Session-Id: $SESSION" \
  -d '{"jsonrpc":"2.0","method":"notifications/initialized"}' > /dev/null

# TEST 1: List Tools via proxy
echo -e "\n2️⃣ LISTING AVAILABLE TOOLS via NATIVE PROXY..."
echo "--------------------------------"
curl -s -X POST ${MCP_PROXY_URL} \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Mcp-Session-Id: $SESSION" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":2}' \
  | sed -n 's/^data: //p' | jq -r '.result.tools | length as $count | "\($count) tools available", (.[:5] | .[] | "  • \(.name)")'

# TEST 2: Call list_datasets via proxy
echo -e "\n3️⃣ CALLING list_datasets TOOL via NATIVE PROXY..."
echo "--------------------------------"
RESPONSE=$(curl -s -X POST ${MCP_PROXY_URL} \
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

# Parse datasets from response (native proxy returns in content[0].text as JSON string)
echo "$RESPONSE" | grep "^data: " | tail -1 | sed 's/^data: //' | jq -r '
  if .result.content[0].text then
    (.result.content[0].text | fromjson) |
    "Found \(.total_count) datasets (showing 3):",
    (.datasets[] |
      "  • \(.table_name) [\(.schema)] - \(.changed_on_humanized)"
    )
  elif .result.structuredContent.datasets then
    "Found \(.result.structuredContent.total_count) datasets (showing 3):",
    (.result.structuredContent.datasets[] |
      "  • \(.table_name) [\(.schema)] - \(.changed_on_humanized)"
    )
  else
    "No datasets found or error"
  end'

# TEST 3: Call get_superset_instance_info via proxy
echo -e "\n4️⃣ GETTING INSTANCE INFO via NATIVE PROXY..."
echo "--------------------------------"
RESPONSE=$(curl -s -X POST ${MCP_PROXY_URL} \
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

# Parse instance info (native proxy returns in content[0].text as JSON string)
echo "$RESPONSE" | grep "^data: " | tail -1 | sed 's/^data: //' | jq -r '
  if .result.content[0].text then
    (.result.content[0].text | fromjson) |
    if .instance_summary then
      .instance_summary |
      "Superset Instance:",
      "• Dashboards: \(.total_dashboards)",
      "• Charts: \(.total_charts)",
      "• Datasets: \(.total_datasets)",
      "• Databases: \(.total_databases)",
      "• Users: \(.total_users)"
    else
      "Could not retrieve instance info from content"
    end
  elif .result.structuredContent.instance_summary then
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

# TEST 4: Check health endpoint
echo -e "\n5️⃣ CHECKING NATIVE PROXY HEALTH..."
echo "--------------------------------"
curl -s ${MCP_PROXY_URL}_health | jq -r '"Status: \(.status)\nProxy: \(.proxy)\nFastMCP: \(.fastmcp)\nCircuit Breaker: \(.circuit_breaker)"'

echo -e "\n====================================="
echo "✅ All NATIVE proxy tests completed!"
echo "====================================="
