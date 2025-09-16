# Superset MCP Service

> **What is this?** The MCP service allows an AI Agent to directly interact with Apache Superset, enabling natural language queries and commands for data visualization.

> **How does it work?** This service is part of the Apache Superset codebase. You need to:
> 1. Have Apache Superset installed and running
> 2. Connect an agent such as Claude Desktop to your Superset instance using this MCP service
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
docker-compose -f docker-compose-light.yml --profile mcp build
docker-compose -f docker-compose-light.yml --profile mcp up -d

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
NODE_PORT=9002 MCP_PORT=5009 docker-compose -f docker-compose-light.yml --profile mcp up -d
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

# 3. Install dependencies
pip install -e .[development,fastmcp]
cd superset-frontend && npm ci && npm run build && cd ..

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
superset run -p 9001 --with-threads --reload --debugger

# 7. Start frontend (in another terminal)
cd superset-frontend && npm run dev

# 8. Start MCP service (in another terminal, optional)
source venv/bin/activate
superset mcp setup
superset mcp run --port 5008 --debug
```

Access Superset at http://localhost:9001 (login: admin/admin)

## 🔌 Step 2: Connect Claude Desktop

### For Docker Setup

Since the MCP service runs inside Docker on port 5008, you need to connect Claude Desktop to the HTTP endpoint:

Add this to your Claude Desktop config file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

Since claude desktop doesnt like non https mcp servers you can use this proxy:
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
