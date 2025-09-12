#!/bin/bash
# Test script for MCP proxy endpoints using curl

set -e  # Exit on any error

# Configuration
SUPERSET_URL="http://localhost:9001"
USERNAME="${SUPERSET_USERNAME:-admin}"
PASSWORD="${SUPERSET_PASSWORD:-admin}"

echo "🔐 Testing MCP Proxy Authentication & Endpoints"
echo "================================================"

# Step 1: Login to get access token
echo "1. Authenticating with Superset..."
LOGIN_RESPONSE=$(curl -s -X POST \
  "${SUPERSET_URL}/api/v1/security/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\": \"${USERNAME}\", \"password\": \"${PASSWORD}\", \"provider\": \"db\"}")

# Check if login was successful
if echo "$LOGIN_RESPONSE" | grep -q '"access_token"'; then
    ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['access_token'])")
    echo "✅ Login successful"
else
    echo "❌ Login failed:"
    echo "$LOGIN_RESPONSE"
    exit 1
fi

# Step 2: Test health endpoint (no auth required)
echo -e "\n2. Testing health endpoint (no auth)..."
curl -s "${SUPERSET_URL}/api/v1/mcp/_health" | python3 -m json.tool

# Step 3: Test info endpoint (auth required)
echo -e "\n3. Testing info endpoint (with auth)..."
curl -s -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  "${SUPERSET_URL}/api/v1/mcp/_info" | python3 -m json.tool

# Step 4: Test MCP tools/list endpoint
echo -e "\n4. Testing MCP tools/list endpoint..."
curl -s -X POST \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  "${SUPERSET_URL}/api/v1/mcp/tools/list" \
  -d '{"jsonrpc": "2.0", "method": "tools/list", "id": 1}' | python3 -m json.tool

# Step 5: Test MCP datasets endpoint
echo -e "\n5. Testing MCP list_datasets endpoint..."
curl -s -X POST \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  "${SUPERSET_URL}/api/v1/mcp/list_datasets" \
  -d '{"jsonrpc": "2.0", "method": "list_datasets", "id": 2, "params": {"page": 1, "page_size": 10}}' | python3 -m json.tool

# Step 6: Test MCP instance info endpoint
echo -e "\n6. Testing MCP instance info endpoint..."
curl -s -X POST \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  "${SUPERSET_URL}/api/v1/mcp/get_superset_instance_info" \
  -d '{"jsonrpc": "2.0", "method": "get_superset_instance_info", "id": 3}' | python3 -m json.tool

echo -e "\n🎉 MCP Proxy test completed!"
