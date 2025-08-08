# Superset MCP Service

> **What is this?** The MCP service allows Claude Desktop to directly interact with Apache Superset, enabling natural language queries and commands for data visualization.

> **How does it work?** This service is part of the Apache Superset codebase. You need to:
> 1. Have Apache Superset installed and running
> 2. Connect Claude Desktop to your Superset instance using this MCP service
> 3. Then Claude can create charts, query data, and manage dashboards

The Superset Model Context Protocol (MCP) service provides a modular, schema-driven interface for programmatic access to Superset dashboards, charts, datasets, and instance metadata. It is designed for LLM agents and automation tools, and is built on the FastMCP protocol.

**Key Features:**
- **20 Tools** - Complete CRUD operations for dashboards, charts, datasets, plus interactive exploration and SQL execution
- **2 Prompts** - Guided workflows for onboarding and chart creation
- **2 Resources** - Real-time instance metadata and visualization templates for enhanced LLM context

**✅ Phase 1 Complete - Production Ready. Core functionality stable, authentication production-ready, comprehensive testing coverage, optimized dashboard layouts, automated test framework.**

## 🚀 Quickstart

### Option 1: Automated Setup (Recommended) 🎯

The fastest way to get everything running:

```bash
# 1. Clone the repository
git clone https://github.com/apache/superset.git
cd superset

# 2. Run automated setup (Python 3.10 or 3.11 required)
make mcp-setup

# 3. Start everything
make mcp-run
```

**That's it!** ✨
- Superset is running at http://localhost:8088 (login: admin/admin)
- MCP service is running on port 5008
- Now configure Claude Desktop (see Step 2 below)

#### What `make mcp-setup` does:
- Creates Python virtual environment
- Installs all dependencies
- Initializes database
- Creates admin user (admin/admin)
- Configures MCP service
- Optionally loads example datasets

#### What `make mcp-run` does:
- Starts Superset backend and frontend
- Starts MCP service on port 5008
- Everything runs in the background

### Option 2: Manual Setup

If you prefer manual control or the make commands don't work:

<details>
<summary>Click to expand manual setup instructions</summary>

```bash
# 1. Clone the repository
git clone https://github.com/apache/superset.git
cd superset

# 2. Set up Python environment
make venv
source venv/bin/activate

# 3. Install dependencies
make install

# 4. Initialize database
superset db upgrade
superset init

# 5. Create admin user
superset fab create-admin \
  --username admin \
  --firstname Admin \
  --lastname Admin \
  --email admin@localhost \
  --password admin

# 6. Start Superset (in one terminal)
superset run -p 8088 --with-threads --reload --debugger

# 7. Start MCP service (in another terminal)
source venv/bin/activate
superset mcp run --port 5008 --debug
```

</details>

## 🔌 Step 2: Connect Claude Desktop

### Option A: CLI Commands (Easiest) ⚡

After setup is complete, use the native CLI tools:

```bash
# For Claude Code (recommended)
cd /path/to/your/superset
claude mcp add superset /path/to/your/superset/venv/bin/python -m superset.mcp_service -e PYTHONPATH=/path/to/your/superset

# For Claude Desktop (alternative)
cd /path/to/your/superset
fastmcp install claude-desktop --server-spec superset/mcp_service/server.py:app --server-name superset --env PYTHONPATH=/path/to/your/superset
```

Then restart your Claude client. That's it! ✨

### Option B: Manual Proxy Connection

If using `make mcp-run` and prefer manual setup:

```json
{
  "mcpServers": {
    "superset": {
      "command": "/absolute/path/to/your/superset/superset/mcp_service/run_proxy.sh",
      "args": [],
      "env": {}
    }
  }
}
```

**Important:** Replace `/absolute/path/to/your/superset` with your actual path!

### Alternative Connection Methods

<details>
<summary>Direct STDIO with npx</summary>

```json
{
  "mcpServers": {
    "superset": {
      "command": "npx",
      "args": ["/absolute/path/to/your/superset/superset/mcp_service", "--stdio"],
      "env": {}
    }
  }
}
```
</details>

<details>
<summary>Direct STDIO with Python</summary>

```json
{
  "mcpServers": {
    "superset": {
      "command": "/absolute/path/to/your/superset/venv/bin/python",
      "args": ["-m", "superset.mcp_service"],
      "env": {
        "PYTHONPATH": "/absolute/path/to/your/superset"
      }
    }
  }
}
```
</details>

### 📍 Claude Desktop Config Location

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

## ✅ Step 3: Verify Everything Works

```bash
# Check setup and configuration
make mcp-check
```

Then in Claude Desktop, try:
- "List all dashboards in Superset"
- "Show me the available datasets"
- "Get superset instance info"

## 🛠️ Available Make Commands

| Command | Description |
|---------|-------------|
| `make mcp-setup` | One-command setup for everything |
| `make mcp-run` | Start Superset + MCP service together |
| `make mcp-check` | Verify setup and configuration |
| `make mcp-stop` | Stop all MCP-related services |
| `make flask-app` | Start only Superset backend |
| `make node-app` | Start only Superset frontend |

## 🚨 Troubleshooting

| Issue | Solution |
|-------|----------|
| Setup fails | Try `make mcp-setup --force` |
| Can't connect | Run `make mcp-check` to diagnose |
| "Command not found" | Use absolute paths in Claude config |
| "No MCP tools" | Restart Claude Desktop after config changes |
| Port already in use | Check with `lsof -i :5008` and `lsof -i :8088` |

## 📚 Documentation

For detailed information about the MCP service, tools, and capabilities, continue reading below.

---

## Transport Modes

### HTTP Transport
The default transport mode runs as an HTTP server on port 5008. This is recommended for:
- Production deployments
- Remote access scenarios
- Integration with web-based MCP clients
- GitHub Codespaces development

### STDIO Transport
The stdio transport uses standard input/output for JSON-RPC communication. This is ideal for:
- Local development with Claude Desktop
- Direct integration without network overhead
- Simplified setup without proxy requirements
- Testing and debugging

#### How STDIO Works

1. **Initialization Handshake**:
   - Client sends `initialize` request
   - Server responds with capabilities
   - Client sends `notifications/initialized` to complete handshake
   - Server is now ready to handle requests

2. **Clean Output**:
   - All Flask/Superset initialization output is redirected to stderr
   - Only JSON-RPC messages go to stdout
   - Click echo/secho output is redirected to stderr

3. **Flask Context**:
   - The service runs within a Flask application context
   - Database connections and configurations are properly initialized

## Environment Variables

The MCP service supports several environment variables for configuration:

- `FASTMCP_TRANSPORT`: Set to "stdio" for stdio mode, "http" for HTTP mode (default: "http")
- `MCP_DEBUG`: Set to "1" to see suppressed initialization output in stderr (stdio mode)
- `SUPERSET_CONFIG_PATH`: Path to your superset_config.py file
- `PYTHONPATH`: Should include the Superset root directory
- `MCP_HOST`: Host to bind to for HTTP transport (default: "127.0.0.1")
- `MCP_PORT`: Port to bind to for HTTP transport (default: 5008)

## Testing the Connection

Use the provided test client to verify the transport:

```bash
# For STDIO transport
python test_mcp_client.py
```

This will test:
- Initialization handshake
- Tools listing
- Tool execution
- Output cleanliness (stdio mode)

## Available Tools, Prompts, and Resources

**20 MCP tools**, **2 prompts**, and **2 resources** with Pydantic v2 schemas and comprehensive field documentation for LLM compatibility.

### 📊 Dashboard Tools (5)
- **`list_dashboards`** - List with advanced filtering, search, pagination, UUID/slug support
- **`get_dashboard_info`** - Get detailed info by ID/UUID/slug with metadata
- **`get_dashboard_available_filters`** - Discover filterable columns and operators
- **`generate_dashboard`** - Create dashboards with multiple charts and automatic layout
- **`add_chart_to_existing_dashboard`** - Add charts to existing dashboards with smart positioning

### 📈 Chart Tools (8)  
- **`list_charts`** - List with advanced filtering, search, pagination, UUID support, cache control
- **`get_chart_info`** - Get detailed info by ID/UUID with full metadata
- **`get_chart_available_filters`** - Discover filterable columns and operators
- **`generate_chart`** - Create and save charts (table, line, bar, area, scatter) with preview
- **`update_chart`** - Update existing saved charts with preview generation
- **`update_chart_preview`** - Update cached chart previews without saving
- **`get_chart_data`** - Export underlying data (JSON/CSV/Excel) with cache control
- **`get_chart_preview`** - Visual previews (screenshots, ASCII art, table, VegaLite)

### 🗂️ Dataset Tools (3)
- **`list_datasets`** - List with columns/metrics, advanced filtering, UUID support, cache control
- **`get_dataset_info`** - Get detailed info by ID/UUID with columns/metrics metadata
- **`get_dataset_available_filters`** - Discover filterable columns and operators

### 🔍 Explore Tools (1)
- **`generate_explore_link`** - Generate pre-configured interactive explore URLs (PREFERRED for visualization)

### 🖥️ System Tools (1)
- **`get_superset_instance_info`** - Comprehensive instance statistics and configuration

### 🧪 SQL Lab Tools (2)
- **`open_sql_lab_with_context`** - Generate pre-configured SQL Lab session URLs
- **`execute_sql`** - Direct SQL execution with security validation, parameters, timeouts

## Available Prompts

**2 MCP prompts** for guided workflows and common scenarios:

### 🚀 System Prompts
- **`superset_quickstart`** - Personalized onboarding for new users
  - Parameters: `user_type` (analyst/executive/developer), `focus_area` (sales/marketing/operations/general)
  - Guides through data exploration, chart creation, and dashboard building

### 📈 Chart Prompts  
- **`create_chart_guided`** - Step-by-step chart creation guidance
  - Parameters: `chart_type` (auto/bar/line/pie/table), `business_goal` (exploration/reporting/monitoring)
  - Helps select appropriate visualizations for specific business needs

## Available Resources

**2 MCP resources** providing contextual information and templates:

### 🌐 System Resources
- **`superset://instance/metadata`** - Comprehensive instance metadata
  - Instance statistics (dataset/dashboard/chart/database counts)
  - Popular datasets ranked by usage
  - Recent dashboards and available chart types
  - Sample queries and database engines
  - Configuration features and usage tips

### 📊 Chart Resources
- **`superset://chart/templates`** - Chart configuration templates and best practices
  - Pre-configured templates for common chart types (line, bar, pie, table, scatter)
  - Color schemes and styling options
  - Performance optimization tips
  - Chart selection guide for different data scenarios

[Content continues with all the existing documentation about workflows, examples, etc...]
