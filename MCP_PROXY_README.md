# Superset MCP Proxy Integration

This document explains how to use the new MCP (Model Context Protocol) proxy endpoint integrated directly into Superset.

## Overview

The MCP proxy provides a single endpoint within Superset that proxies requests to the FastMCP service, eliminating the need to manage separate MCP client connections. This integration provides:

- **Single deployment unit** - No need to manage separate MCP processes
- **Authentication & authorization** - Uses Superset's existing security model
- **Rate limiting** - Prevents abuse and ensures fair resource usage
- **Circuit breaker** - Automatically handles FastMCP service failures
- **SSE streaming** - Real-time chart generation progress
- **Multi-tenant context** - Injects user/tenant information for multi-tenant deployments

## Architecture

```
┌─────────────────────────────────────────┐
│                Browser/Client           │
└─────────────────┬───────────────────────┘
                  │ HTTP/SSE
┌─────────────────▼───────────────────────┐
│            Superset Flask App           │
│  ┌─────────────────────────────────────┐│
│  │          MCP Proxy Blueprint        ││
│  │   /api/v1/mcp/* endpoints           ││
│  │   - Authentication                  ││
│  │   - Rate limiting                   ││
│  │   - Context injection               ││
│  └─────────────────┬───────────────────┘│
└────────────────────┼────────────────────┘
                     │ HTTP Proxy
┌────────────────────▼────────────────────┐
│           FastMCP Service               │
│         (localhost:5008)                │
│   - Chart generation                    │
│   - Dataset management                  │
│   - SQL Lab integration                 │
└─────────────────────────────────────────┘
```

## Configuration

### 1. Enable MCP Service

Add to your `superset_config.py`:

```python
# Import MCP configuration
from superset.config_mcp import *

# Or manually configure:
FEATURE_FLAGS = {
    **FEATURE_FLAGS,
    "MCP_SERVICE": True,
}
```

### 2. Configure MCP Service Connection

```python
# FastMCP service location
MCP_SERVICE_HOST = "localhost"  # or "mcp-service" in Docker
MCP_SERVICE_PORT = 5008

# Rate limiting (requests per minute per user)
MCP_RATE_LIMIT_REQUESTS = 100
MCP_RATE_LIMIT_WINDOW_SECONDS = 60

# Circuit breaker (resilience)
MCP_CIRCUIT_BREAKER_FAILURE_THRESHOLD = 5
MCP_CIRCUIT_BREAKER_RECOVERY_TIMEOUT = 60

# SSE streaming limits
MCP_STREAMING_MAX_SIZE_MB = 10
```

## API Endpoints

Once enabled, the following endpoints are available:

### Health & Info

```bash
# Check proxy and FastMCP service health
GET /api/v1/mcp/_health

# Get service information (requires auth)
GET /api/v1/mcp/_info
```

### MCP Protocol Endpoints

All standard MCP endpoints are available under `/api/v1/mcp/`:

```bash
# List available tools
POST /api/v1/mcp/tools/list

# Call a specific tool
POST /api/v1/mcp/tools/call

# List datasets
POST /api/v1/mcp/list_datasets

# Generate charts (with SSE streaming)
POST /api/v1/mcp/generate_chart
```

## Usage Examples

### Python Client

```python
import requests

# Login to get token
login_response = requests.post("http://localhost:8088/api/v1/security/login", json={
    "username": "admin",
    "password": "admin"
})
token = login_response.json()["access_token"]

# Call MCP endpoint through proxy
headers = {"Authorization": f"Bearer {token}"}
mcp_request = {
    "jsonrpc": "2.0",
    "method": "tools/list",
    "id": 1
}

response = requests.post(
    "http://localhost:8088/api/v1/mcp/tools/list",
    headers=headers,
    json=mcp_request
)

tools = response.json()["result"]["tools"]
print(f"Found {len(tools)} MCP tools")
```

### JavaScript Client

```javascript
// Login and get token
const loginResponse = await fetch('/api/v1/security/login', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({username: 'admin', password: 'admin'})
});
const {access_token} = await loginResponse.json();

// Call MCP endpoint
const mcpResponse = await fetch('/api/v1/mcp/tools/list', {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        jsonrpc: "2.0",
        method: "tools/list",
        id: 1
    })
});

const {result} = await mcpResponse.json();
console.log(`Found ${result.tools.length} tools`);
```

### SSE Streaming

For chart generation with real-time progress:

```javascript
const eventSource = new EventSource('/api/v1/mcp/generate_chart?' +
    new URLSearchParams({
        dataset_id: 123,
        chart_type: 'line',
        // ... other params
    }), {
    headers: {'Authorization': `Bearer ${access_token}`}
});

eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.status === 'progress') {
        console.log(`Progress: ${data.percentage}%`);
    } else if (data.status === 'complete') {
        console.log('Chart generated:', data.chart_url);
        eventSource.close();
    }
};
```

## Deployment

### Single Process (Recommended)

Use supervisor to manage both services:

```ini
# /etc/supervisor/conf.d/superset-with-mcp.conf
[group:superset-with-mcp]
programs=superset-app,mcp-service

[program:superset-app]
command=superset run -p 8088 --host 0.0.0.0
environment=MCP_SERVICE_HOST=localhost,MCP_SERVICE_PORT=5008

[program:mcp-service]
command=superset mcp run --host 127.0.0.1 --port 5008
```

### Docker Compose

```yaml
version: '3.8'
services:
  superset:
    build: .
    ports: ["8088:8088"]
    environment:
      - FEATURE_FLAGS_MCP_SERVICE=true
      - MCP_SERVICE_HOST=mcp-service
    depends_on: [mcp-service]

  mcp-service:
    build: .
    command: ["superset", "mcp", "run", "--host", "0.0.0.0", "--port", "5008"]
    expose: ["5008"]
```

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: superset-with-mcp
spec:
  template:
    spec:
      containers:
      - name: superset
        image: superset:latest
        ports: [containerPort: 8088]
        env:
        - name: MCP_SERVICE_HOST
          value: "localhost"
        - name: FEATURE_FLAGS_MCP_SERVICE  
          value: "true"
      - name: mcp-service
        image: superset:latest
        command: ["superset", "mcp", "run"]
        ports: [containerPort: 5008]
```

## Testing

Run the included test script:

```bash
# Make sure Superset and FastMCP are running
superset run &  # Terminal 1
superset mcp run &  # Terminal 2

# Run tests
python test_mcp_proxy.py
```

Expected output:
```
✅ Direct FastMCP test passed
✅ Health endpoint test passed  
✅ Info endpoint test passed
✅ MCP tools/list proxy test passed
🎉 All tests passed! MCP proxy is working correctly.
```

## Security Considerations

- **Authentication**: All endpoints require valid Superset authentication
- **Authorization**: Users need `can_explore` permission on `Superset` view
- **Rate Limiting**: Per-user request limits prevent abuse
- **Input Validation**: All requests are validated before proxying
- **Circuit Breaker**: Automatically stops requests during FastMCP failures
- **Memory Limits**: SSE responses are size-limited to prevent DoS attacks

## Monitoring & Observability

### Health Checks

```bash
# Proxy health
curl http://localhost:8088/api/v1/mcp/_health

# Service info
curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:8088/api/v1/mcp/_info
```

### Logs

MCP proxy logs include:
- Request/response tracking with trace IDs
- Rate limiting violations
- Circuit breaker state changes
- Authentication failures
- Performance metrics

### Metrics

Monitor these key metrics:
- Request rate per user
- Error rate to FastMCP service
- Response time percentiles
- Circuit breaker open/close events
- SSE connection counts

## Troubleshooting

### Common Issues

1. **"MCP service is not enabled"**
   - Add `FEATURE_FLAGS = {"MCP_SERVICE": True}` to config

2. **"MCP service unavailable"**
   - Check FastMCP service is running on correct host/port
   - Verify network connectivity
   - Check circuit breaker status in `/_health`

3. **"Rate limit exceeded"**
   - Increase `MCP_RATE_LIMIT_REQUESTS` in config
   - Check for runaway requests

4. **SSE streaming issues**
   - Ensure reverse proxy (nginx/Apache) allows SSE
   - Check `MCP_STREAMING_MAX_SIZE_MB` limits
   - Verify client handles `text/event-stream` content type

### Debug Mode

Enable detailed logging:

```python
# superset_config.py
MCP_LOG_LEVEL = "DEBUG"
MCP_LOG_REQUESTS = True
```

This will log all proxy requests and responses for debugging.

## Migration from Standalone MCP

If you were using standalone MCP clients, migrate to the proxy:

**Before:**
```python
from mcp import Client
client = Client("http://localhost:5008/mcp")
```

**After:**  
```python
import requests
headers = {"Authorization": f"Bearer {superset_token}"}
response = requests.post("http://localhost:8088/api/v1/mcp/tools/list",
                        headers=headers, json=mcp_request)
```

The proxy provides the same MCP protocol but with Superset's authentication and enterprise features.
