# Superset MCP Service

> **What is this?** The MCP service allows Claude Desktop to directly interact with Apache Superset, enabling natural language queries and commands for data visualization.

> **How does it work?** This service is part of the Apache Superset codebase. You need to:
> 1. Have Apache Superset installed and running
> 2. Connect Claude Desktop to your Superset instance using this MCP service
> 3. Then Claude can create charts, query data, and manage dashboards

The Superset Model Context Protocol (MCP) service provides a modular, schema-driven interface for programmatic access to Superset dashboards, charts, datasets, and instance metadata. It is designed for LLM agents and automation tools, and is built on the FastMCP protocol.

## 🚀 Quickstart

### Option 1: Docker Setup (Recommended) 🎯

The fastest way to get everything running with Docker:

**Prerequisites:** Docker and Docker Compose installed

```bash
# 1. Clone the repository
git clone https://github.com/apache/superset.git
cd superset

# 2. Start Superset and MCP service with docker-compose-light
docker compose -f docker-compose-light.yml --profile mcp build
docker compose -f docker-compose-light.yml --profile mcp up -d

# 3. Initialize Superset (first time only)
docker exec -it superset-superset-light-1 superset fab create-admin \
  --username admin \
  --firstname Admin \
  --lastname Admin \
  --email admin@localhost \
  --password admin

docker exec -it superset-superset-light-1 superset db upgrade
docker exec -it superset-superset-light-1 superset init
```

**That's it!** ✨
- Superset frontend is running at http://localhost:9001 (login: admin/admin)
- MCP service is running on port 5008
- Now configure Claude Desktop (see Step 2 below)

#### What Docker Compose does:
- Sets up PostgreSQL database
- Builds and runs Superset containers
- Starts the MCP service (with `--profile mcp`)
- Handles all networking and dependencies
- Provides hot-reload for development

#### Customizing ports:
```bash
# Use different ports if defaults are in use
NODE_PORT=9002 MCP_PORT=5009 docker compose -f docker-compose-light.yml --profile mcp up -d
```

### Option 2: Manual Setup

If Docker is not available, you can set up manually:

```bash
# 1. Clone the repository
git clone https://github.com/apache/superset.git
cd superset

# 2. Set up Python environment (Python 3.10 or 3.11 required)
python3 -m venv venv
source venv/bin/activate

# Install external dependencies
pip install -r requirements/development.txt

# Install Superset in editable (development) mode
pip install -e .[development,fastmcp]

# Create an admin user in your metadata database
superset fab create-admin \
                --username admin \
                --firstname "Admin I."\
                --lastname Strator \
                --email admin@superset.io \
                --password general

# Initialize the database
superset db upgrade

# Create default roles and permissions
superset init

# Load some data to play with
superset load-examples

# Install node packages
cd superset-frontend; npm ci; cd ..

# Start Superset (in one terminal)
source venv/bin/activate
superset run -p 9001 --with-threads --reload --debugger

# Start Superset MCP Service (in another terminal)
source venv/bin/activate
superset mcp run --port 5008 --debug

```

Access Superset at http://localhost:9001 (login: admin/admin)

## 🔌 Step 2: Connect Claude Desktop

### For Docker Setup

Since the MCP service runs inside Docker on port 5008, you need to connect Claude Desktop to the HTTP endpoint:

Add this to your Claude Desktop config file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
**Linux**: `~/.config/Claude/claude_desktop_config.json`

Since claude desktop doesnt like non https mcp servers you can use this proxy:
If you run the mcp service on localhost 5008 use this:
```json
{
  "mcpServers": {
    "Superset MCP Proxy": {
      "command": "/<superset folder>/superset/mcp_service/run_proxy.sh",
      "args": [],
      "env": {}
    }
  }
}
```

If you would like to use the `/api/v1/mcp-client/` endpoint use this:

```json
{
  "mcpServers": {
    "Superset MCP Proxy": {
      "command": "/<superset folder>/superset/mcp_service/run_proxy_to_mcp_client.sh",
      "args": [],
      "env": {}
    }
  }
}
```
Also make sure your `superset_config.py` looks like this:

```python
import os

# Enable MCP service integration
FEATURE_FLAGS = {
    "MCP_SERVICE": True,
}

# MCP Service Connection config for the /api/v1/mcp-proxy endpoint - experimental
MCP_SERVICE_HOST = os.environ.get("MCP_SERVICE_HOST", "localhost")
MCP_SERVICE_PORT = int(os.environ.get("MCP_SERVICE_PORT", 5008))
```

### For Local Setup (Make/Manual)

If running MCP locally (not in Docker), use the direct connection:

```json
{
  "mcpServers": {
    "superset": {
      "command": "npx",
      "args": ["/path/to/your/superset/superset/mcp_service"],
      "env": {
        "PYTHONPATH": "/path/to/your/superset"
      }
    }
  }
}
```

Then restart Claude Desktop. That's it! ✨


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

## ✅ Step 3: Verify Everything Works

For Docker setup:
```bash
# Check if services are running
docker compose -f docker-compose-light.yml ps

# Check MCP service logs
docker compose -f docker-compose-light.yml logs superset-mcp-light
```

For manual setup:
```bash

# Check Superset is running
curl http://localhost:9001/health
```

Then in Claude Desktop, try:
- "List all dashboards in Superset"
- "Show me the available datasets"
- "Get superset instance info"

## Testing the Connection

Use the provided test client to verify the transport:

```bash
# For testing mcp service over http (localhost 5008)
./test_mcp_all.sh

# For testing mcp service over the /api/v1/mcp-client endpoint
./test_mcp_client_proxy.sh
```
