# Superset MCP Playground

> **⚠️ Development Environment Only**: This playground is designed for development, testing, and sandboxing. Do not use this setup for production environments or with sensitive data.

The Superset MCP (Model Context Protocol) Playground provides a complete development and testing environment for interacting with Superset through AI assistants like Claude.

## Overview

The MCP Playground consists of:
1. **Superset Instance** - Your data visualization platform
2. **MCP Service** - Exposes Superset functionality via standardized protocol
3. **ModelContextChat.com** - Web-based chat interface to interact with Superset via Claude

## Quick Start

### 1. Start the Services

```bash
# Using Docker Compose (recommended)
docker-compose -f docker-compose-light.yml --profile mcp up

# Or in Codespaces
ENABLE_MCP=true .devcontainer/start-superset.sh
```

This starts:
- Superset on port 9001
- MCP Service on port 5008

### 2. Connect via ModelContextChat.com

1. Open [ModelContextChat.com](https://modelcontextchat.com) in your browser
2. Configure MCP connection:
   - Server URL: `http://localhost:5008`
   - Add any required authentication
3. Start chatting with Claude about your Superset data!

## Example Interactions

```
You: "Can you list my dashboards?"
Claude: [Lists all dashboards with IDs and published status]

You: "Show me the charts in the Sales Dashboard"
Claude: [Displays charts with their types and datasets]

You: "Create a line chart showing revenue over time"
Claude: [Generates chart configuration and creates it]

You: "Export the data from the COVID Vaccine Dashboard"
Claude: [Exports data in your preferred format]
```

## Benefits

- **No-code Access**: Interact with Superset using natural language
- **Rapid Exploration**: Quickly navigate dashboards and datasets
- **AI-Powered Analysis**: Let Claude help analyze and visualize your data
- **Developer Friendly**: Test MCP integrations without writing code

## Architecture

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────┐
│ ModelContext    │────▶│ MCP Service  │────▶│  Superset   │
│ Chat.com        │     │ (Port 5008)  │     │ (Port 9001) │
└─────────────────┘     └──────────────┘     └─────────────┘
        │                                              │
        └──────────── Claude AI ──────────────────────┘
```

## Security Notes

- **This setup is for local development and sandboxing only**
- Never expose MCP ports publicly in production
- Always implement proper authentication for production use
- MCP respects Superset's RBAC permissions
- Use private networking and VPNs for any non-development deployments

## Documentation

- [MCP Service Documentation](docs/docs/mcp-service/intro.mdx)
- [Using ModelContextChat.com](docs/docs/mcp-service/modelcontextchat.mdx)
- [API Reference](docs/docs/mcp-service/api-reference.mdx)

## Troubleshooting

### MCP Service Not Responding
```bash
# Check if service is running
curl http://localhost:5008/health

# Check logs
docker-compose -f docker-compose-light.yml logs superset-mcp-light
```

### Connection Issues in ModelContextChat
- Ensure MCP service is accessible from your browser
- Check for CORS issues if using different domains
- Verify authentication is configured correctly
