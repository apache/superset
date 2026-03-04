---
title: MCP Server Deployment & Authentication
hide_title: true
sidebar_position: 9
version: 1
---

<!--
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
-->

# MCP Server Deployment & Authentication

Superset includes a built-in [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that allows AI assistants like Claude, ChatGPT, and other MCP-compatible clients to interact with your Superset instance — listing dashboards, querying datasets, executing SQL, and more.

This guide covers how to deploy the MCP server and configure authentication for your Superset installation.

---

## Prerequisites

- A running Apache Superset instance (version 5.0+)
- Python 3.10+
- The `fastmcp` package installed (`pip install fastmcp`)

---

## Quick Start

### 1. Start the MCP Server

The MCP server runs as a separate process alongside your Superset instance:

```bash
superset mcp run --host 127.0.0.1 --port 5008
```

**Options:**

| Flag | Default | Description |
|------|---------|-------------|
| `--host` | `127.0.0.1` | Host to bind to |
| `--port` | `5008` | Port to bind to |
| `--debug` | `false` | Enable debug logging |

The MCP endpoint will be available at `http://<host>:<port>/mcp`.

### 2. Configure a Development User

For local development and testing, set a default user in `superset_config.py`:

```python
# superset_config.py
MCP_DEV_USERNAME = "admin"
```

This tells the MCP server which Superset user to run tool operations as when no JWT authentication is configured. The user must exist in your Superset database.

### 3. Connect an AI Client

Once the server is running, connect an MCP client. For example, in Claude Desktop:

```json
{
  "mcpServers": {
    "superset": {
      "url": "http://localhost:5008/mcp"
    }
  }
}
```

**Config file locations for Claude Desktop:**
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

After saving the config, restart Claude Desktop. Look for the hammer/tools icon to confirm the server is connected.

---

## Authentication

The MCP server supports multiple authentication methods to suit different deployment scenarios.

### Development Mode (No Auth)

For local development, disable authentication and use a fixed user:

```python
# superset_config.py
MCP_AUTH_ENABLED = False
MCP_DEV_USERNAME = "admin"
```

The MCP server will execute all operations as the configured user. This is the simplest setup for getting started.

:::warning
Never use development mode in production. Always enable authentication for any internet-facing deployment.
:::

### JWT Authentication

For production deployments, enable JWT-based authentication. The MCP server validates Bearer tokens on every request.

#### Option A: RS256 with JWKS Endpoint

Use this when your identity provider publishes a JWKS (JSON Web Key Set) endpoint:

```python
# superset_config.py
MCP_AUTH_ENABLED = True
MCP_JWT_ALGORITHM = "RS256"
MCP_JWKS_URI = "https://your-identity-provider.com/.well-known/jwks.json"
MCP_JWT_ISSUER = "https://your-identity-provider.com/"
MCP_JWT_AUDIENCE = "your-superset-instance"
```

#### Option B: RS256 with Static Public Key

Use this when you have a fixed RSA public key:

```python
# superset_config.py
MCP_AUTH_ENABLED = True
MCP_JWT_ALGORITHM = "RS256"
MCP_JWT_PUBLIC_KEY = """-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...
-----END PUBLIC KEY-----"""
MCP_JWT_ISSUER = "your-issuer"
MCP_JWT_AUDIENCE = "your-audience"
```

#### Option C: HS256 with Shared Secret

Use this for simpler setups where both the token issuer and the MCP server share a secret:

```python
# superset_config.py
MCP_AUTH_ENABLED = True
MCP_JWT_ALGORITHM = "HS256"
MCP_JWT_SECRET = "your-shared-secret-key"
MCP_JWT_ISSUER = "your-issuer"
MCP_JWT_AUDIENCE = "your-audience"
```

:::warning
Store `MCP_JWT_SECRET` securely. Never commit it to version control. Use environment variables:
```python
import os
MCP_JWT_SECRET = os.environ.get("MCP_JWT_SECRET")
```
:::

#### Required JWT Claims

The MCP server validates these JWT claims:

| Claim | Config Key | Description |
|-------|-----------|-------------|
| `iss` | `MCP_JWT_ISSUER` | Token issuer (optional but recommended) |
| `aud` | `MCP_JWT_AUDIENCE` | Token audience (optional but recommended) |
| `exp` | — | Expiration time (always validated) |
| `sub` | — | Subject — used to resolve the Superset user |

#### User Resolution

When a JWT is validated, the MCP server resolves the Superset user from the token claims in this order:

1. `sub` (subject) claim
2. `client_id` claim
3. `email` claim from the payload
4. `username` claim from the payload

The resolved value must match a username in your Superset database.

#### Scoped Access

You can require specific scopes in the JWT:

```python
# superset_config.py
MCP_REQUIRED_SCOPES = ["mcp:read", "mcp:write"]
```

Only tokens that include all required scopes will be accepted.

### Connecting Clients with JWT

To connect a client that sends JWT tokens, use `mcp-remote` with a Bearer token header:

```json
{
  "mcpServers": {
    "superset": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote@latest",
        "http://your-superset-host:5008/mcp",
        "--header",
        "Authorization: Bearer YOUR_JWT_TOKEN"
      ]
    }
  }
}
```

You can also make direct HTTP requests with the token:

```bash
curl -X POST 'http://localhost:5008/mcp' \
  --header 'Authorization: Bearer YOUR_JWT_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{"jsonrpc": "2.0", "method": "tools/list", "id": 1}'
```

### Custom Auth Provider

For advanced authentication scenarios (e.g., integrating with your own auth system), provide a custom auth factory:

```python
# superset_config.py
def my_custom_auth_factory(app):
    """Return a FastMCP auth provider instance."""
    from fastmcp.server.auth.providers.jwt import JWTVerifier
    return JWTVerifier(
        jwks_uri="https://my-auth.example.com/.well-known/jwks.json",
        issuer="https://my-auth.example.com/",
        audience="superset-mcp",
    )

MCP_AUTH_FACTORY = my_custom_auth_factory
```

The `MCP_AUTH_FACTORY` takes precedence over the built-in JWT configuration when set.

---

## Connecting AI Clients

### Claude Desktop

**Option 1: Direct URL (Recommended for local)**

```json
{
  "mcpServers": {
    "superset": {
      "url": "http://localhost:5008/mcp"
    }
  }
}
```

**Option 2: With authentication**

```json
{
  "mcpServers": {
    "superset": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote@latest",
        "http://your-superset-host:5008/mcp",
        "--header",
        "Authorization: Bearer YOUR_TOKEN"
      ]
    }
  }
}
```

### Claude Web (claude.ai)

1. Open [claude.ai](https://claude.ai)
2. Click the **+** button (or your profile icon)
3. Select **Connectors**
4. Click **Manage Connectors** > **Add custom connector**
5. Enter a name and your MCP URL (e.g., `https://your-superset-host/mcp`)
6. Click **Add**

:::info
Custom connectors on Claude Web require a Pro, Max, Team, or Enterprise plan.
:::

### ChatGPT

1. Click your profile icon > **Settings** > **Apps and Connectors**
2. Enable **Developer Mode** in Advanced Settings
3. In the chat composer, press **+** > **Add sources** > **App** > **Connect more** > **Create app**
4. Enter a name and your MCP server URL
5. Click **I understand and continue**

:::info
ChatGPT connectors require a Pro, Team, Enterprise, or Edu plan.
:::

### Claude Code (CLI)

Add to your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "superset": {
      "type": "url",
      "url": "http://localhost:5008/mcp"
    }
  }
}
```

Or with authentication:

```json
{
  "mcpServers": {
    "superset": {
      "type": "url",
      "url": "http://localhost:5008/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_TOKEN"
      }
    }
  }
}
```

---

## Deployment

### Single-Pod Deployment (Simple)

The simplest production setup runs the MCP server as a single process alongside Superset:

```
┌─────────────────────────────────┐
│         Single Pod / VM         │
│                                 │
│  ┌───────────┐  ┌────────────┐  │
│  │ Superset  │  │ MCP Server │  │
│  │ (port     │  │ (port      │  │
│  │  8088)    │  │  5008)     │  │
│  └─────┬─────┘  └──────┬─────┘  │
│        │               │        │
│        └───────┬───────┘        │
│                │                │
│         ┌──────┴──────┐         │
│         │  Database   │         │
│         │ (Postgres)  │         │
│         └─────────────┘         │
└─────────────────────────────────┘
```

**Steps:**

1. Add the MCP configuration to `superset_config.py`:

```python
# superset_config.py
MCP_SERVICE_HOST = "0.0.0.0"
MCP_SERVICE_PORT = 5008
MCP_DEV_USERNAME = "admin"  # or enable JWT auth (see above)
```

2. Start the MCP server alongside Superset:

```bash
# Start Superset (in one terminal or as a service)
superset run -h 0.0.0.0 -p 8088

# Start MCP server (in another terminal or as a service)
superset mcp run --host 0.0.0.0 --port 5008
```

3. Place a reverse proxy (e.g., Nginx) in front to handle TLS termination:

```nginx
server {
    listen 443 ssl;
    server_name superset.example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # Superset web UI
    location / {
        proxy_pass http://127.0.0.1:8088;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # MCP endpoint
    location /mcp {
        proxy_pass http://127.0.0.1:5008/mcp;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header Authorization $http_authorization;
    }
}
```

### Docker Deployment

Run both services in Docker:

```yaml
# docker-compose.yml
services:
  superset:
    image: apache/superset:latest
    ports:
      - "8088:8088"
    volumes:
      - ./superset_config.py:/app/superset_config.py
    environment:
      - SUPERSET_CONFIG_PATH=/app/superset_config.py

  mcp:
    image: apache/superset:latest
    command: ["superset", "mcp", "run", "--host", "0.0.0.0", "--port", "5008"]
    ports:
      - "5008:5008"
    volumes:
      - ./superset_config.py:/app/superset_config.py
    environment:
      - SUPERSET_CONFIG_PATH=/app/superset_config.py
    depends_on:
      - superset
```

### Multi-Pod Deployment (Kubernetes)

For high-availability deployments with multiple MCP server replicas, configure Redis for shared session state:

```python
# superset_config.py
MCP_STORE_CONFIG = {
    "enabled": True,
    "CACHE_REDIS_URL": "redis://redis-host:6379/0",
    "event_store_max_events": 100,
    "event_store_ttl": 3600,
}
```

When `CACHE_REDIS_URL` is set, the MCP server automatically uses Redis-backed EventStore for session management, allowing multiple replicas to share state.

```
┌──────────────────────────────────────────────┐
│              Kubernetes Cluster               │
│                                               │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐      │
│  │ MCP Pod │  │ MCP Pod │  │ MCP Pod │      │
│  │    1    │  │    2    │  │    3    │      │
│  └────┬────┘  └────┬────┘  └────┬────┘      │
│       │            │            │            │
│       └────────────┼────────────┘            │
│                    │                         │
│             ┌──────┴──────┐                  │
│             │    Redis    │                  │
│             │  (sessions) │                  │
│             └─────────────┘                  │
└──────────────────────────────────────────────┘
```

---

## Configuration Reference

All MCP configuration is set in `superset_config.py`.

### Core Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `MCP_SERVICE_HOST` | `"localhost"` | Host to bind the MCP server to |
| `MCP_SERVICE_PORT` | `5008` | Port to bind the MCP server to |
| `MCP_DEBUG` | `False` | Enable debug logging |
| `MCP_DEV_USERNAME` | — | Superset username for development mode (no auth) |

### JWT Authentication

| Setting | Default | Description |
|---------|---------|-------------|
| `MCP_AUTH_ENABLED` | `False` | Enable JWT authentication |
| `MCP_JWT_ALGORITHM` | `"RS256"` | JWT algorithm (`RS256` or `HS256`) |
| `MCP_JWKS_URI` | `None` | JWKS endpoint URL (for RS256) |
| `MCP_JWT_PUBLIC_KEY` | `None` | Static RSA public key (for RS256) |
| `MCP_JWT_SECRET` | `None` | Shared secret (for HS256) |
| `MCP_JWT_ISSUER` | `None` | Expected `iss` claim |
| `MCP_JWT_AUDIENCE` | `None` | Expected `aud` claim |
| `MCP_REQUIRED_SCOPES` | `[]` | Required JWT scopes |
| `MCP_JWT_DEBUG_ERRORS` | `False` | Enable detailed server-side JWT error logging |
| `MCP_AUTH_FACTORY` | `None` | Custom auth provider factory function |

### Response Size Guard

| Setting | Default | Description |
|---------|---------|-------------|
| `MCP_RESPONSE_SIZE_CONFIG` | See below | Controls response size limits for LLM clients |

```python
MCP_RESPONSE_SIZE_CONFIG = {
    "enabled": True,
    "token_limit": 25000,
    "warn_threshold_pct": 80,
    "excluded_tools": ["health_check", "get_chart_preview"],
}
```

### Caching

| Setting | Default | Description |
|---------|---------|-------------|
| `MCP_CACHE_CONFIG` | See below | Response caching configuration |

```python
MCP_CACHE_CONFIG = {
    "enabled": False,
    "list_tools_ttl": 300,
    "call_tool_ttl": 3600,
    "excluded_tools": ["execute_sql", "generate_dashboard"],
}
```

### Redis Store (Multi-Pod)

| Setting | Default | Description |
|---------|---------|-------------|
| `MCP_STORE_CONFIG` | See below | Redis store for multi-pod session management |

```python
MCP_STORE_CONFIG = {
    "enabled": False,
    "CACHE_REDIS_URL": None,
    "event_store_max_events": 100,
    "event_store_ttl": 3600,
}
```

---

## Troubleshooting

### Server Won't Start

- Ensure `fastmcp` is installed: `pip install fastmcp`
- Check that `MCP_DEV_USERNAME` is set if auth is disabled
- Verify the configured port is not already in use

### 401 Unauthorized

- Verify your JWT token is not expired
- Check that `MCP_JWT_ISSUER` and `MCP_JWT_AUDIENCE` match the token's claims
- For RS256: confirm the JWKS URI is reachable or the public key is correct
- For HS256: confirm the secret matches between issuer and MCP server
- Enable `MCP_JWT_DEBUG_ERRORS = True` for detailed server-side logging

### Tool Not Found

- Ensure the MCP server is using the same `superset_config.py` as your Superset instance
- Check server logs for tool registration errors on startup

### Client Can't Connect

- Verify the MCP server URL is reachable from the client
- For Claude Desktop: completely quit and restart after config changes
- For remote access: ensure your firewall/reverse proxy allows traffic to the MCP port
- Check that the URL path ends with `/mcp` (e.g., `http://localhost:5008/mcp`)

### Permission Errors on Tool Calls

- The MCP server uses Superset's RBAC system — the authenticated user must have the required roles and permissions
- In development mode, ensure `MCP_DEV_USERNAME` maps to a user with appropriate roles (e.g., Admin)

---

## Security Notes

- Always use TLS (HTTPS) for production MCP endpoints
- Enable JWT authentication for any internet-facing deployment
- The MCP server respects Superset's RBAC permissions — users can only access data their roles allow
- Store secrets (`MCP_JWT_SECRET`, API keys) in environment variables, not in config files
- Review the [Security documentation](./security) for extension-specific security guidance

---

## Next Steps

- **[MCP Integration](./mcp)** — Build custom MCP tools and prompts via extensions
- **[Security](./security)** — Security best practices for extensions
- **[Deployment](./deployment)** — Package and deploy Superset extensions
