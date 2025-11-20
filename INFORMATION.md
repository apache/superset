# Apache Superset Custom Setup - Complete Information

## Overview

This document describes the complete setup for running a customized Apache Superset instance that uses existing infrastructure (PostgreSQL, Redis, Nginx) and includes custom features (3D Model viewer, Button component with API proxy, CORS configurations).

---

## Table of Contents

1. [Infrastructure Setup](#infrastructure-setup)
2. [Customizations Made](#customizations-made)
3. [Building the Custom Image](#building-the-custom-image)
4. [Running Superset](#running-superset)
5. [Configuration Files](#configuration-files)
6. [Issues Encountered and Solutions](#issues-encountered-and-solutions)
7. [Troubleshooting](#troubleshooting)

---

## Infrastructure Setup

### External Services Used

This Superset setup uses **existing services** running on the host instead of creating new Docker containers:

1. **PostgreSQL** - Running in Docker container `keycloak_postgres`
   - **Host Port**: 5444 (mapped from container's 5432)
   - **Database**: `superset`
   - **User**: `superset`
   - **Password**: `idtcities123`
   - **Connection**: `postgresql+psycopg2://superset:idtcities123@host.docker.internal:5444/superset`

2. **Redis** - Running on host (or in another container)
   - **Host**: `host.docker.internal`
   - **Port**: 6379
   - **Connection**: `redis://host.docker.internal:6379`

3. **Nginx** - Running on host
   - **Port**: 78 (custom port)
   - **Configuration**: Should proxy to Superset at `http://localhost:8088`

### Why External Services?

- Avoid port conflicts
- Reuse existing infrastructure
- No need to create duplicate services
- Better resource management

---

## Customizations Made

### 1. CORS and Content Security Policy (CSP)

**File**: `superset/config.py`

**Changes**:
- Added IDT Cities domains to CSP `connect-src`:
  - `http://home.idtcities.com`
  - `https://home.idtcities.com`
  - `https://app.idtcities.com`
  - `http://home.snap4idtcity.com`
  - `https://home.snap4idtcity.com`
  - `https://app.snap4idtcity.com`
- Added GitHub domains for 3D model loading:
  - `https://raw.githubusercontent.com`
  - `https://github.com`

**Location**: Lines 1911-1930 and 1958-1977 in `superset/config.py`

### 2. API Proxy Endpoint

**File**: `superset/views/api.py`

**New Endpoint**: `/api/v1/proxy/`

**Purpose**: Allows Button components to make external API calls through Superset's backend, bypassing browser CSP restrictions.

**Features**:
- Authenticated endpoint (requires login)
- Supports GET, POST, PUT, PATCH methods
- Custom headers and payload support
- 30-second timeout
- Returns status code, data, headers, and success flag

**Location**: Lines 136-208 in `superset/views/api.py`

### 3. Button Component with API Proxy

**File**: `superset-frontend/src/dashboard/components/gridComponents/Button/Button.tsx`

**Features**:
- Custom draggable button component for dashboards
- Two action types:
  - **Link**: Navigate to URL
  - **API**: Call external/internal API endpoint
- Automatic proxy routing for external URLs
- Error handling and success toasts
- Configurable via dashboard UI

**Key Implementation**:
- Detects external URLs (starts with `http://` or `https://`)
- Routes external calls through `/api/v1/proxy/` endpoint
- Handles internal endpoints normally

**Location**: Lines 330-450 in `Button.tsx`

### 4. 3D Model Viewer Component

**File**: `superset-frontend/src/dashboard/components/gridComponents/Model3D/Model3D.tsx`

**Features**:
- Custom draggable 3D model viewer for dashboards
- Uses `@google/model-viewer` web component
- Supports GLB/GLTF model formats
- Configurable via `modelUrl` meta property
- Debounced URL input (500ms)
- Error handling and loading states

**Dependencies**:
- `@google/model-viewer` package (already in package.json)

**Location**: Complete file `Model3D.tsx`

---

## Building the Custom Image

### Prerequisites

- Docker installed
- Docker Compose installed
- Source code with all customizations

### Build Command

```bash
# Build the production image with customizations
docker build \
  --target lean \
  --tag superset-custom:latest \
  --build-arg BUILD_TRANSLATIONS=false \
  --build-arg DEV_MODE=false \
  --progress=plain \
  .
```

**Build Time**: 15-30 minutes (first time), faster on subsequent builds with cache

**What Gets Built**:
- Frontend assets (React/TypeScript with customizations)
- Python backend (Flask with API proxy endpoint)
- All dependencies
- Custom components (Button, Model3D)

### Build Targets

- **`lean`**: Production-ready image (recommended)
- **`dev`**: Development image with hot-reload

---

## Running Superset

### Docker Compose Configuration

**File**: `docker-compose.yml`

**Key Points**:
- Uses external PostgreSQL, Redis, and Nginx (all commented out)
- Builds from source (includes customizations)
- Exposes Superset on port 8088

### Required Environment File

**File**: `docker/.env`

**Required Configuration**:

```bash
# PostgreSQL Configuration (keycloak_postgres container)
DATABASE_DIALECT=postgresql+psycopg2
DATABASE_USER=superset
DATABASE_PASSWORD=idtcities123
DATABASE_HOST=host.docker.internal
DATABASE_PORT=5444
DATABASE_DB=superset

POSTGRES_USER=superset
POSTGRES_PASSWORD=idtcities123
POSTGRES_DB=superset

# Redis Configuration
REDIS_HOST=host.docker.internal
REDIS_PORT=6379
REDIS_CELERY_DB=0
REDIS_RESULTS_DB=1

# Superset Configuration
SECRET_KEY=your-secret-key-here
SUPERSET_LOAD_EXAMPLES=no

# Other required variables (see complete .env template below)
```

### Complete docker/.env File

```bash
#
# Licensed to the Apache Software Foundation (ASF) under one or more
# contributor license agreements.  See the NOTICE file distributed with
# this work for additional information regarding copyright ownership.
# The ASF licenses this file to You under the Apache License, Version 2.0
# (the "License"); you may not use this file except in compliance with
# the License.  You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#

# Allowing python to print() in docker
PYTHONUNBUFFERED=1

COMPOSE_PROJECT_NAME=superset

DEV_MODE=true

# database configurations (do not modify)
DATABASE_DB=superset
DATABASE_HOST=host.docker.internal
DATABASE_PASSWORD=idtcities123
DATABASE_USER=superset

EXAMPLES_DB=examples
EXAMPLES_HOST=host.docker.internal
EXAMPLES_USER=examples
EXAMPLES_PASSWORD=examples
EXAMPLES_PORT=5444

# database engine specific environment variables
DATABASE_PORT=5444
DATABASE_DIALECT=postgresql+psycopg2

POSTGRES_DB=superset
POSTGRES_USER=superset
POSTGRES_PASSWORD=idtcities123

# Add the mapped in /app/pythonpath_docker which allows devs to override stuff
PYTHONPATH=/app/pythonpath:/app/docker/pythonpath_dev

REDIS_HOST=host.docker.internal
REDIS_PORT=6379
REDIS_CELERY_DB=0
REDIS_RESULTS_DB=1

# Development and logging configuration
FLASK_DEBUG=true
SUPERSET_LOG_LEVEL=info

SUPERSET_APP_ROOT="/"
SUPERSET_ENV=development
SUPERSET_LOAD_EXAMPLES=no

CYPRESS_CONFIG=false
SUPERSET_PORT=8088

MAPBOX_API_KEY=''

# Make sure you set this to a unique secure random value on production
SUPERSET_SECRET_KEY=TEST_NON_DEV_SECRET

ENABLE_PLAYWRIGHT=false
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
BUILD_SUPERSET_FRONTEND_IN_DOCKER=true
```

### Starting Services

```bash
# Start all services
docker compose up

# Or run in detached mode
docker compose up -d

# View logs
docker compose logs -f

# Check status
docker compose ps
```

### Accessing Superset

- **Direct**: `http://localhost:8088`
- **Via Nginx**: `http://your-domain:78` (after configuring Nginx)

**Default Credentials**:
- Username: `admin`
- Password: `admin` (change immediately!)

---

## Configuration Files

### docker-compose.yml

**Key Configuration**:
- **PostgreSQL service**: Commented out (using external)
- **Redis service**: Commented out (using external)
- **Nginx service**: Commented out (using external)
- **Superset services**: Build from source
- **Port mappings**: Superset on 8088, WebSocket on 8080

**Services**:
1. `superset-init` - Database initialization
2. `superset` - Main application
3. `superset-worker` - Celery worker
4. `superset-worker-beat` - Celery beat scheduler
5. `superset-websocket` - WebSocket server
6. `superset-node` - Frontend dev server (development)

### Nginx Configuration

**Required Nginx Config** (for external Nginx on port 78):

```nginx
upstream superset_app {
    server localhost:8088;
    keepalive 100;
}

upstream superset_websocket {
    server localhost:8080;
    keepalive 100;
}

server {
    listen 78;
    server_name _;

    # WebSocket support
    location /ws {
        proxy_pass http://superset_websocket;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Main Superset application
    location / {
        proxy_pass http://superset_app;
        proxy_set_header Host $http_host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_redirect off;
        proxy_buffering off;
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
        proxy_read_timeout 300;
        send_timeout 300;
    }
}
```

---

## Issues Encountered and Solutions

### Issue 1: Port Conflicts

**Error**: `failed to bind host port for 127.0.0.1:6379: address already in use`

**Cause**: Redis was already running on the host

**Solution**: 
- Commented out Redis service in `docker-compose.yml`
- Configured all services to use `REDIS_HOST=host.docker.internal`
- Added `extra_hosts: - "host.docker.internal:host-gateway"` to all services

### Issue 2: PostgreSQL Port Mismatch

**Error**: `connection to server at "host.docker.internal" (172.17.0.1), port 5432 failed: Connection timed out`

**Cause**: 
- `keycloak_postgres` container exposes PostgreSQL on port **5444** on host (not 5432)
- `.env` file had `DATABASE_PORT=5432`

**Solution**:
- Updated `docker/.env` to use `DATABASE_PORT=5444`
- Updated `docker-compose.yml` environment variables to use port 5444
- Updated `EXAMPLES_PORT=5444`

### Issue 3: Database Connection Using Wrong Host

**Error**: `ERROR: Cannot connect to database postgresql+psycopg2://superset:idtcities123@db:5432/superset`

**Cause**: 
- Environment variables were using `DATABASE_HOST=db` (Docker service name)
- Should use `DATABASE_HOST=host.docker.internal` for external PostgreSQL

**Solution**:
- Updated `docker/.env` with `DATABASE_HOST=host.docker.internal`
- Added environment variables to `docker-compose.yml` services
- Ensured all services have `extra_hosts` configured

### Issue 4: Redis Connection Timeout

**Error**: `[ioredis] Unhandled error event: Error: connect ETIMEDOUT`

**Cause**: 
- Redis not accessible from Docker containers
- Redis might be in a container or not running

**Solution**:
- Verify Redis is running: `redis-cli ping`
- Check Redis is listening: `sudo netstat -tuln | grep 6379`
- Ensure Redis accepts connections from Docker network
- If Redis is in a container, use container name or exposed port

### Issue 5: Docker Compose Validation Error

**Error**: `services.superset-init.depends_on must be a array`

**Cause**: 
- Commented out `depends_on` entries left as object structure instead of array

**Solution**:
- Completely commented out `depends_on` section
- Removed dependency on `db` and `redis` services

### Issue 6: DuckDB Module Error

**Error**: `sqlalchemy.exc.NoSuchModuleError: Can't load plugin: sqlalchemy.dialects:duckdb`

**Cause**: 
- Examples loading requires DuckDB, but `lean` Docker image doesn't include it

**Solution**:
- Set `SUPERSET_LOAD_EXAMPLES=no` in `docker/.env`
- This skips example loading and avoids DuckDB requirement

---

## Troubleshooting

### Database Connection Issues

**Check PostgreSQL is accessible**:
```bash
# From host
psql -h localhost -p 5444 -U superset -d superset -c "SELECT 1;"

# From container
docker compose exec superset psql -h host.docker.internal -p 5444 -U superset -d superset
```

**Verify port mapping**:
```bash
docker ps | grep keycloak_postgres
# Should show: 0.0.0.0:5444->5432/tcp
```

**Check environment variables**:
```bash
docker compose exec superset env | grep DATABASE
# Should show DATABASE_HOST=host.docker.internal and DATABASE_PORT=5444
```

### Redis Connection Issues

**Check Redis is running**:
```bash
redis-cli ping
# Should return: PONG
```

**Test from container**:
```bash
docker compose exec superset ping -c 1 host.docker.internal
docker compose exec superset redis-cli -h host.docker.internal -p 6379 ping
```

**Check Redis configuration**:
```bash
# Check if Redis is listening
sudo netstat -tuln | grep 6379

# Check Redis bind configuration
redis-cli CONFIG GET bind
```

### Build Issues

**Clean build** (if build fails):
```bash
docker compose build --no-cache
```

**Check Docker resources**:
```bash
docker system df
docker stats
```

### Initialization Issues

**Check init logs**:
```bash
docker compose logs superset-init
```

**Re-run initialization**:
```bash
docker compose restart superset-init
```

**Manual database setup** (if needed):
```bash
docker compose exec superset superset db upgrade
docker compose exec superset superset init
```

### Port Conflicts

**Check what's using ports**:
```bash
# Check port 8088
sudo lsof -i :8088
sudo netstat -tuln | grep 8088

# Check port 5444 (PostgreSQL)
sudo lsof -i :5444
sudo netstat -tuln | grep 5444

# Check port 6379 (Redis)
sudo lsof -i :6379
sudo netstat -tuln | grep 6379
```

### WebSocket Issues

**Check WebSocket service**:
```bash
docker compose logs superset-websocket
docker compose ps superset-websocket
```

**Verify Redis connection for WebSocket**:
- WebSocket service needs Redis for pub/sub
- Ensure `REDIS_HOST=host.docker.internal` is set
- Check WebSocket can reach Redis

---

## Quick Reference

### Important Ports

- **8088**: Superset main application
- **8080**: Superset WebSocket server
- **9000**: Frontend dev server (development only)
- **5444**: PostgreSQL (keycloak_postgres container)
- **6379**: Redis
- **78**: Nginx (external)

### Important Hosts

- **host.docker.internal**: Access host services from containers
- **keycloak_postgres**: PostgreSQL container name (if on same network)

### Key Files

- `docker-compose.yml`: Service definitions
- `docker/.env`: Environment configuration
- `superset/config.py`: CORS/CSP configuration
- `superset/views/api.py`: API proxy endpoint
- `superset-frontend/src/dashboard/components/gridComponents/Button/Button.tsx`: Button component
- `superset-frontend/src/dashboard/components/gridComponents/Model3D/Model3D.tsx`: 3D Model component

### Common Commands

```bash
# Start services
docker compose up -d

# Stop services
docker compose down

# View logs
docker compose logs -f

# Rebuild after code changes
docker compose up --build

# Check status
docker compose ps

# Execute commands in container
docker compose exec superset bash
docker compose exec superset superset db upgrade
```

---

## Summary

### What Was Done

1. ✅ Configured Superset to use external PostgreSQL (keycloak_postgres on port 5444)
2. ✅ Configured Superset to use external Redis (host.docker.internal:6379)
3. ✅ Configured Superset to use external Nginx (port 78)
4. ✅ Added CORS/CSP configurations for IDT Cities domains
5. ✅ Created API proxy endpoint for external API calls
6. ✅ Added custom Button component with API proxy support
7. ✅ Added custom 3D Model viewer component
8. ✅ Built custom Docker image with all changes
9. ✅ Configured docker-compose.yml to use external services

### Current Status

- **Build**: Custom image builds successfully with all customizations
- **Database**: Configured to use keycloak_postgres on port 5444
- **Redis**: Configured to use host Redis
- **Nginx**: External Nginx should proxy to port 8088
- **Customizations**: All custom features included in build

### Next Steps

1. Ensure `docker/.env` file has correct configuration (especially `DATABASE_PORT=5444`)
2. Verify PostgreSQL is accessible on port 5444
3. Verify Redis is accessible on port 6379
4. Configure external Nginx to proxy to `localhost:8088`
5. Run `docker compose up` to start services
6. Access Superset at `http://localhost:8088` or via Nginx on port 78

---

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review logs: `docker compose logs -f`
3. Verify environment variables: `docker compose exec superset env | grep -E 'DATABASE|REDIS'`
4. Test connections from containers

---

**Last Updated**: 2025-11-20  
**Superset Version**: Custom build with modifications  
**Docker Compose Version**: 3.8+

