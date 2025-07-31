# Setting Up Claude Desktop for MCP Testing

## Prerequisites
1. Claude Desktop installed
2. Superset running on port 8088
3. MCP service running on port 5008

## Configuration Steps

### 1. Edit Claude Desktop Configuration

Add this to your Claude Desktop config file (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "superset-mcp": {
      "command": "/path/to/superset/superset/mcp_service/run_proxy.sh",
      "args": [],
      "env": {}
    }
  }
}
```

Replace `/path/to/superset` with your actual path.

### 2. Restart Claude Desktop

After updating the config, restart Claude Desktop to load the MCP connection.

### 3. Verify Connection

In Claude Desktop, you should see the MCP tools available. Try:
```
List all charts using the MCP tools
```

If you see the tools working, then Claude CLI will also work.

## Alternative: Direct API Testing

If you can't get Claude Desktop configured, use the Python test runner with an Anthropic API key instead:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
python run_mcp_tests.py MCP_CHART_TEST_PLAN.md
```

## Troubleshooting

1. **Check proxy is running**: The proxy should start automatically when Claude Desktop starts
2. **Check MCP service**: Ensure `superset mcp run --port 5008` is running
3. **Check logs**: Look at Claude Desktop logs for connection errors
4. **Permissions**: Make sure `run_proxy.sh` is executable (`chmod +x run_proxy.sh`)
