# Multi-Tenancy Development Setup

## WebSocket Support for Hot Module Replacement (HMR)

To enable `/ws` WebSocket endpoint for webpack dev server hot reloading with multitenancy:

### Docker Compose Files

Superset provides two Docker Compose configurations:

#### `docker-compose.yml` (Full Setup)
- **Services**: Flask app, webpack dev server, Redis, nginx, Celery workers, websocket service
- **Ports**: 
  - Flask: `8088`
  - Webpack dev server: `9000` (bound to `127.0.0.1:9000`)
- **Use case**: Full development environment with all features (async queries, background tasks, etc.)

#### `docker-compose-light.yml` (Lightweight Setup)
- **Services**: Flask app, webpack dev server, database only (no Redis, no workers)
- **Ports**:
  - Flask: `8088`
  - Webpack dev server: `9001` (configurable via `NODE_PORT`)
- **Use case**: Minimal setup for faster startup, testing, or when you don't need Celery/Redis

### 1. Start All Services

**For `docker-compose.yml` (full setup):**
```bash
docker-compose up
```

This starts:
- `superset` (Flask backend on port 8088)
- `superset-node` (webpack dev server on port 9000, accessible at `127.0.0.1:9000`)
- `redis` (cache and Celery broker)
- `superset-websocket` (async query WebSocket service on port 8080)
- `superset-worker` (Celery worker)
- `superset-worker-beat` (Celery scheduler)
- `nginx` (reverse proxy on port 80)

**For `docker-compose-light.yml` (lightweight setup):**
```bash
docker-compose -f docker-compose-light.yml up
```

This starts:
- `superset-light` (Flask backend on port 8088)
- `superset-node-light` (webpack dev server on port 9001)
- `db-light` (PostgreSQL database)

### 2. Access Through Webpack Dev Server

**Important**: Access Superset through the webpack dev server port, not directly through Flask:

**For `docker-compose.yml`:**
- ✅ **Correct**: `http://acme.analytics.local:9000` (webpack dev server)
- ❌ **Wrong**: `http://acme.analytics.local:8088` (Flask directly - `/ws` won't work)

**For `docker-compose-light.yml`:**
- ✅ **Correct**: `http://acme.analytics.local:9001` (webpack dev server, or `NODE_PORT` if set)
- ❌ **Wrong**: `http://acme.analytics.local:8088` (Flask directly - `/ws` won't work)

The webpack dev server:
- Handles `/ws` WebSocket connections for HMR
- Proxies all other requests to Flask backend (port 8088)
- Preserves the original `Host` header for tenant discovery

### 3. Tenant Discovery with Subdomains

When accessing through the webpack dev server:
- The original `Host` header (e.g., `acme.analytics.local:9000` or `acme.analytics.local:9001`) is preserved
- The tenant discovery middleware reads the subdomain from the `Host` header
- Tenant context is set correctly for all proxied requests

**Note**: The webpack proxy configuration has been updated to preserve the `Host` header for multitenancy support.

### 4. Configuration

The webpack proxy configuration (`superset-frontend/webpack.proxy-config.js`) has been updated to:
- Preserve the original `Host` header (`hostRewrite: false`)
- Set `X-Forwarded-Host` header for reference
- Allow subdomain-based tenant discovery to work correctly

### 5. Verify It's Working

**For `docker-compose.yml`:**
1. Start services: `docker-compose up`
2. Access via subdomain: `http://acme.analytics.local:9000`
3. Check browser console - you should see:
   - ✅ WebSocket connection to `/ws` succeeds (no 404 errors)
   - ✅ Hot Module Replacement (HMR) working
   - ✅ Tenant discovered correctly (check Network tab for `Host` header)

**For `docker-compose-light.yml`:**
1. Start services: `docker-compose -f docker-compose-light.yml up`
2. Access via subdomain: `http://acme.analytics.local:9001` (or `NODE_PORT` if set)
3. Check browser console - you should see:
   - ✅ WebSocket connection to `/ws` succeeds (no 404 errors)
   - ✅ Hot Module Replacement (HMR) working
   - ✅ Tenant discovered correctly (check Network tab for `Host` header)

### Troubleshooting

**If `/ws` still returns 404:**
- **For `docker-compose.yml`**: Ensure `superset-node` service is running, access through port 9000
- **For `docker-compose-light.yml`**: Ensure `superset-node-light` service is running, access through port 9001
- Check that you're accessing through webpack dev server port, not Flask port (8088)
- Verify webpack dev server logs show it's listening on the correct port

**If tenant discovery doesn't work:**
- Check that the `Host` header is preserved in proxied requests
- Verify subdomain is correctly formatted (e.g., `acme.analytics.local:9001`)
- Check middleware logs for tenant discovery messages

**If HMR doesn't work:**
- Ensure webpack dev server is in development mode
- Check browser console for WebSocket connection errors
- Verify `hot: true` is set in webpack config (it is by default in dev mode)

