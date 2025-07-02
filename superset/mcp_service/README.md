# Superset MCP Service

A Model Context Protocol (MCP) service for Apache Superset that provides programmatic access to dashboards, charts, and datasets through both REST API and FastMCP endpoints.

## Quick Start

### Installation

The MCP service is included with Superset. For FastMCP support (optional), install the extra:

```bash
pip install "apache-superset[fastmcp]"
```

### Running the Service

#### CLI Command
```bash
# Basic usage
superset mcp run

# With custom port and debug
superset mcp run --port 5008 --debug --sql-debug
```

#### PyCharm Debugging
Create a PyCharm run configuration:

**Script path:** `./venv/bin/superset`  
**Parameters:** `mcp run --port 5008 --debug --sql-debug`  
**Working directory:** `/path/to/superset`

This runs the service with debug mode enabled on port 5008.

### Claude Desktop Integration

#### For Claude Pro, Max, Team, and Enterprise Plans
Users on paid plans can use direct remote server integration:

```json
{
  "mcpServers": {
    "Superset MCP": {
      "url": "http://your-server-url:your-port/mcp/",
      "auth": {
        "type": "bearer",
        "token": "your-api-key"
      }
    }
  }
}
```

#### For Free Claude Desktop Users
Free users need to use a local proxy script since remote server support is not available:

```json
{
  "mcpServers": {
    "Superset MCP Proxy": {
      "command": "/path/to/superset/superset/mcp_service/run_proxy.sh",
      "args": [],
      "env": {}
    }
  }
}
```

Both approaches connect to the FastMCP service. For more details, see the [FastMCP Claude Desktop integration guide](https://gofastmcp.com/integrations/claude-desktop).

## API Endpoints

### REST API (Port 5008)
- `GET /api/mcp/v1/health` - Service health check
- `GET /api/mcp/v1/list_dashboards` - List dashboards with simple filtering (query parameters)
- `POST /api/mcp/v1/list_dashboards` - List dashboards with advanced filtering (JSON payload)
- `GET /api/mcp/v1/dashboard/<id>` - Get dashboard details
- `GET /api/mcp/v1/instance_info` - Get Superset instance information

### FastMCP Tools (Port 5009)
- `list_dashboards` - Advanced filtering with complex filter objects
- `list_dashboards_simple` - Simple filtering with individual parameters
- `get_dashboard_info` - Get detailed dashboard information
- `health_check` - Service health verification
- `get_superset_instance_high_level_information` - Instance metadata
- `get_available_filters` - Available filter options

## Authentication

Use API key authentication:
```bash
curl -H "Authorization: Bearer your-secret-api-key-here" http://localhost:5008/api/mcp/v1/health
```

Default API key: `your-secret-api-key-here` (for development)

## Configuration

Set environment variables to customize behavior:

```bash
export MCP_API_KEY="your-secret-api-key-here"
```

## Development

The service runs alongside but independently of Superset. It provides:

- **REST API**: Direct HTTP access to dashboard data
- **FastMCP Tools**: AI-friendly interface for Claude Desktop and other MCP clients
- **Dual Filtering**: Both simple query parameters and advanced JSON filtering
- **Authentication**: API key-based security
- **Standalone Operation**: Independent of main Superset web server

For more details, see the [architecture documentation](README_ARCHITECTURE.md). 
