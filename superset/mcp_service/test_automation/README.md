# MCP Test Automation

## Two Ways to Test MCP

### 1. Claude CLI (❌ Doesn't Work)
```bash
./test_claude_cli.sh
```
- Fails because CLI cannot serialize MCP tool parameters correctly
- Tools expect `{"request": {...}}` but CLI sends malformed JSON

### 2. Anthropic API with MCP Beta (✅ Works)
- **Docs**: https://docs.anthropic.com/en/docs/agents-and-tools/mcp-connector
- **Beta header**: `anthropic-beta: mcp-client-2025-04-04`
- **Requires**: Public URL (not localhost)

## Setup for API Testing

### 1. Install ngrok
```bash
brew install ngrok
```

### 2. Expose MCP Service
```bash
ngrok http 5008
# Copy the HTTPS URL (e.g., https://abc123.ngrok-free.app)
```

### 3. Update test_mcp_beta.py
```python
"url": "https://YOUR-NGROK-ID.ngrok-free.app/mcp",
```

### 4. Run Tests
```bash
python test_mcp_beta.py
```

## Requirements
- Anthropic API key in `superset_config.py`
- Superset running on port 8088
- MCP service running on port 5008
