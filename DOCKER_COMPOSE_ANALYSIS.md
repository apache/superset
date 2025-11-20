# Docker Compose Files Analysis

## Overview

Apache Superset provides multiple Docker Compose configurations for different use cases: development, production-like, lightweight, custom images, and tagged releases. This document analyzes all Docker Compose files and their purposes.

---

## 1. Main Docker Compose Files

### 1.1 `docker-compose.yml` - Full Development Stack

**Purpose**: Complete development environment with all services

**Services Included**:

1. **nginx** (Port 80)
   - Reverse proxy
   - Loads config from `docker/nginx/nginx.conf`
   - Template-based configuration

2. **redis** (Port 6379, localhost only)
   - Cache and message broker
   - Volume: `redis:/data`
   - Image: `redis:7`

3. **db** (PostgreSQL 16, Port 5432, localhost only)
   - Metadata database
   - Volume: `db_home:/var/lib/postgresql/data`
   - Init scripts from `docker/docker-entrypoint-initdb.d`

4. **superset** (Port 8088)
   - Main application server
   - Command: `/app/docker/docker-bootstrap.sh app`
   - Depends on: `superset-init`
   - Volumes: Full source code mounted for hot-reload

5. **superset-websocket** (Port 8080)
   - WebSocket server for real-time features
   - Built from `./superset-websocket`
   - Config: `docker/superset-websocket/config.example.json`
   - Excludes `node_modules` and `dist` (OS-specific)

6. **superset-init**
   - Database initialization
   - Runs migrations, creates admin user
   - Command: `/app/docker/docker-init.sh`
   - Runs once, then exits

7. **superset-node** (Port 9000, localhost only)
   - Webpack dev server for frontend
   - Hot-reload for frontend changes
   - Environment: `BUILD_SUPERSET_FRONTEND_IN_DOCKER: true`

8. **superset-worker**
   - Celery worker for async tasks
   - Concurrency: 2
   - Health check: Celery ping

9. **superset-worker-beat**
   - Celery beat scheduler
   - Scheduled tasks (reports, alerts)

10. **superset-tests-worker** (Optional profile)
    - Test-specific worker
    - Network mode: host
    - Separate Redis DBs (2, 3)
    - Concurrency: 8

**Key Features**:
- Full source code mounting for development
- Hot-reload for both Python and JavaScript
- Webpack dev server on port 9000
- All services for complete development experience
- Environment file support: `docker/.env` (required) + `docker/.env-local` (optional)

**Build Configuration**:
```yaml
x-common-build: &common-build
  context: .
  target: ${SUPERSET_BUILD_TARGET:-dev}  # dev or lean
  cache_from:
    - apache/superset-cache:3.10-slim-trixie
  args:
    DEV_MODE: "true"
    INCLUDE_CHROMIUM: ${INCLUDE_CHROMIUM:-false}
    INCLUDE_FIREFOX: ${INCLUDE_FIREFOX:-false}
    BUILD_TRANSLATIONS: ${BUILD_TRANSLATIONS:-false}
    LOAD_EXAMPLES_DUCKDB: ${LOAD_EXAMPLES_DUCKDB:-true}
```

**Volumes**:
- Source code directories mounted
- `superset_home` - User data
- `superset_data` - Example data
- `db_home` - PostgreSQL data
- `redis` - Redis data

---

### 1.2 `docker-compose-non-dev.yml` - Production-Like (No Dev Volumes)

**Purpose**: Production-like environment without development volumes

**Key Differences from `docker-compose.yml`**:
- **No source code mounting** - Uses built image only
- **No superset-node** - No webpack dev server
- **No superset-websocket** - WebSocket service excluded
- **No nginx** - Direct access to Superset
- **Gunicorn** - Uses `app-gunicorn` command instead of dev server
- **Minimal volumes** - Only `superset_home` mounted

**Services**:
1. `redis` - Cache
2. `db` - PostgreSQL
3. `superset` - Main app (Gunicorn)
4. `superset-init` - Initialization
5. `superset-worker` - Celery worker
6. `superset-worker-beat` - Scheduler

**Use Case**: Testing production-like setup without full production deployment

**Build Target**: `dev` (not `lean`)

---

### 1.3 `docker-compose-light.yml` - Lightweight Multi-Instance

**Purpose**: Minimal setup for running multiple Superset instances or running tests

**Key Features**:
- **No Redis** - Uses SimpleCache instead
- **Isolated databases** - Each instance uses `superset_light` DB
- **Parameterized ports** - `NODE_PORT` environment variable (default: 9001)
- **Test runner** - `pytest-runner` service with test profile
- **Separate volumes** - `_light` suffix for isolation

**Services**:
1. `db-light` - PostgreSQL with `superset_light` database
2. `superset-light` - Main app
3. `superset-init-light` - Initialization
4. `superset-node-light` - Webpack dev server (port configurable)
5. `pytest-runner` - Test execution service (profile: `test`)

**Multi-Instance Usage**:
```bash
# Instance 1
docker-compose -p project1 -f docker-compose-light.yml up

# Instance 2 (different port)
NODE_PORT=9002 docker-compose -p project2 -f docker-compose-light.yml up
```

**Test Execution**:
```bash
# Run all tests
docker-compose -f docker-compose-light.yml run --rm pytest-runner pytest tests/unit_tests/

# Run specific test
docker-compose -f docker-compose-light.yml run --rm pytest-runner pytest tests/unit_tests/test_foo.py

# Force reload test DB
docker-compose -f docker-compose-light.yml run --rm -e FORCE_RELOAD=true pytest-runner pytest tests/
```

**Configuration**:
- Uses `superset_config_docker_light.py`
- Test config: `superset_test_config_light`
- Separate test database: `test`

---

### 1.4 `docker-compose.custom.yml` - Pre-Built Custom Image

**Purpose**: Use a pre-built custom Superset image instead of building from source

**Key Features**:
- **Pre-built image** - `superset-custom:latest`
- **No build step** - Assumes image already exists
- **Health checks** - For Redis and PostgreSQL
- **Minimal services** - Only essential services

**Services**:
1. `redis` - With health check
2. `db` - PostgreSQL with health check
3. `superset-init` - Initialization
4. `superset` - Main app

**Use Case**: 
- Using a custom-built image
- Production deployments with custom image
- CI/CD pipelines with pre-built images

**Prerequisites**:
- Image `superset-custom:latest` must exist
- Build image first using Dockerfile

---

### 1.5 `docker-compose-image-tag.yml` - Tagged Release Image

**Purpose**: Use official tagged Superset images from Docker Hub

**Key Features**:
- **Official images** - `apachesuperset.docker.scarf.sh/apache/superset:${TAG:-latest-dev}`
- **Configurable tag** - Set `TAG` environment variable
- **Production-ready** - Uses `app-gunicorn` command
- **No build** - Pulls from registry

**Services**:
1. `redis`
2. `db`
3. `superset-init`
4. `superset` - Main app (Gunicorn)
5. `superset-worker` - Celery worker
6. `superset-worker-beat` - Scheduler

**Usage**:
```bash
# Use latest dev image
docker-compose -f docker-compose-image-tag.yml up

# Use specific version
TAG=5.0.0 docker-compose -f docker-compose-image-tag.yml up
```

**Volumes**:
- Only `superset_home` and minimal config
- No source code mounting

---

## 2. Common Patterns & Configuration

### 2.1 Environment Files

All compose files support:
- **`docker/.env`** - Required base configuration
- **`docker/.env-local`** - Optional local overrides (git-ignored)

**Example `.env` variables**:
```bash
POSTGRES_USER=superset
POSTGRES_PASSWORD=superset
POSTGRES_DB=superset
REDIS_HOST=redis
REDIS_PORT=6379
SECRET_KEY=your-secret-key-here
```

### 2.2 Volume Patterns

**Development volumes** (full stack):
```yaml
volumes:
  - ./docker:/app/docker
  - ./superset:/app/superset
  - ./superset-core:/app/superset-core
  - ./superset-frontend:/app/superset-frontend
  - superset_home:/app/superset_home
  - ./tests:/app/tests
  - superset_data:/app/data
```

**Production volumes** (minimal):
```yaml
volumes:
  - superset_home:/app/superset_home
```

### 2.3 Build Arguments

Common build arguments:
- `SUPERSET_BUILD_TARGET` - `dev` (default) or `lean`
- `DEV_MODE` - `true` for development, `false` for production
- `INCLUDE_CHROMIUM` - Include Chromium for screenshots
- `INCLUDE_FIREFOX` - Include Firefox (deprecated)
- `BUILD_TRANSLATIONS` - Build translation files
- `LOAD_EXAMPLES_DUCKDB` - Pre-populate examples database

### 2.4 Service Dependencies

**Dependency Chain**:
```
superset-init
  ├── depends_on: db (service_started)
  └── depends_on: redis (service_started)

superset
  └── depends_on: superset-init (service_completed_successfully)

superset-worker
  └── depends_on: superset-init (service_completed_successfully)

superset-worker-beat
  └── depends_on: superset-worker (service_started)
```

---

## 3. Service Details

### 3.1 Superset Application

**Commands**:
- `app` - Development server (Flask dev server)
- `app-gunicorn` - Production server (Gunicorn)
- `worker` - Celery worker
- `beat` - Celery beat scheduler

**Ports**:
- `8088` - Main application
- `8081` - Cypress mode (testing)

**Health Checks**:
- Worker: `celery -A superset.tasks.celery_app:app inspect ping`

### 3.2 Database Initialization

**Process**:
1. Wait for database to be ready
2. Run `superset db upgrade` (migrations)
3. Run `superset init` (create roles/permissions)
4. Optionally load examples

**Script**: `/app/docker/docker-init.sh`

### 3.3 Frontend Development

**Webpack Dev Server**:
- Port: `9000` (default) or `NODE_PORT` (light)
- Hot-reload enabled
- Proxy to backend: `http://superset:8088`

**Build Options**:
- `BUILD_SUPERSET_FRONTEND_IN_DOCKER` - Build in container vs host
- `NPM_RUN_PRUNE` - Clean node_modules before install

### 3.4 WebSocket Server

**Configuration**:
- Config file: `docker/superset-websocket/config.json`
- Example: `docker/superset-websocket/config.example.json`
- Port: `8080`

**Volumes**:
- Source code mounted
- `node_modules` and `dist` excluded (OS-specific)

---

## 4. Network Configuration

### 4.1 Service Communication

**Internal Network**:
- Services communicate via service names
- `superset` → `db:5432`
- `superset` → `redis:6379`
- `superset-node` → `superset:8088`

**Host Access**:
- `host.docker.internal:host-gateway` - Access host from container
- Used for connecting to external services

### 4.2 Port Mapping

**Development**:
- `80` - Nginx (full stack only)
- `8088` - Superset app
- `9000` - Webpack dev server
- `8080` - WebSocket server
- `5432` - PostgreSQL (localhost only)
- `6379` - Redis (localhost only)

**Production**:
- `8088` - Superset app only

---

## 5. Volume Management

### 5.1 Named Volumes

**Persistent Data**:
- `superset_home` - User data, configs
- `db_home` - PostgreSQL data
- `redis` - Redis data
- `superset_data` - Example databases

**Lightweight Volumes**:
- `superset_home_light` - Isolated instance data
- `db_home_light` - Isolated database

### 5.2 Bind Mounts

**Development**:
- Source code directories
- Configuration files
- Test files

**Production**:
- Configuration only
- No source code

---

## 6. Environment Variables

### 6.1 Database Configuration

```bash
DATABASE_HOST=db
DATABASE_DB=superset
POSTGRES_USER=superset
POSTGRES_PASSWORD=superset
SUPERSET__SQLALCHEMY_DATABASE_URI=postgresql+psycopg2://...
```

### 6.2 Redis Configuration

```bash
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_CELERY_DB=0
REDIS_RESULTS_DB=1
```

### 6.3 Superset Configuration

```bash
SUPERSET_CONFIG_PATH=/app/docker/pythonpath_dev/superset_config.py
SUPERSET__SQLALCHEMY_EXAMPLES_URI=duckdb:////app/data/examples.duckdb
SUPERSET_LOG_LEVEL=info
```

### 6.4 Frontend Configuration

```bash
WEBPACK_DEVSERVER_HOST=127.0.0.1
WEBPACK_DEVSERVER_PORT=9000
BUILD_SUPERSET_FRONTEND_IN_DOCKER=true
```

---

## 7. Usage Examples

### 7.1 Development Setup

```bash
# Start full development stack
docker-compose up

# Start in background
docker-compose up -d

# View logs
docker-compose logs -f superset

# Rebuild after changes
docker-compose build --no-cache
docker-compose up
```

### 7.2 Production-Like Testing

```bash
# Use non-dev compose
docker-compose -f docker-compose-non-dev.yml up

# Build first
docker-compose -f docker-compose-non-dev.yml build
```

### 7.3 Multiple Instances

```bash
# Instance 1
docker-compose -p instance1 -f docker-compose-light.yml up

# Instance 2 (different port)
NODE_PORT=9002 docker-compose -p instance2 -f docker-compose-light.yml up
```

### 7.4 Testing

```bash
# Run tests
docker-compose -f docker-compose-light.yml --profile test run --rm pytest-runner pytest tests/

# Run specific test
docker-compose -f docker-compose-light.yml --profile test run --rm pytest-runner pytest tests/unit_tests/test_foo.py

# Interactive shell
docker-compose -f docker-compose-light.yml --profile test run --rm pytest-runner bash
```

### 7.5 Custom Image

```bash
# Build custom image
docker build --target lean --tag superset-custom:latest .

# Use custom image
docker-compose -f docker-compose.custom.yml up
```

### 7.6 Tagged Release

```bash
# Use specific version
TAG=5.0.0 docker-compose -f docker-compose-image-tag.yml up

# Use latest
docker-compose -f docker-compose-image-tag.yml up
```

---

## 8. Troubleshooting

### 8.1 Common Issues

**Port Already in Use**:
```bash
# Check what's using the port
lsof -i :8088
# Or on Windows
netstat -ano | findstr :8088

# Change port in compose file or stop conflicting service
```

**Database Connection Errors**:
- Ensure `superset-init` completed successfully
- Check database is running: `docker-compose ps db`
- Verify credentials in `docker/.env`

**Frontend Not Loading**:
- Check `superset-node` service is running
- Verify webpack dev server on port 9000
- Check browser console for errors

**Memory Issues**:
- Increase Docker memory limit (8GB+ recommended)
- Reduce `CELERYD_CONCURRENCY` in worker
- Use `lean` build target instead of `dev`

### 8.2 Clean Start

```bash
# Stop and remove everything
docker-compose down -v

# Remove all volumes
docker volume prune

# Rebuild from scratch
docker-compose build --no-cache
docker-compose up
```

### 8.3 Debugging

**View Logs**:
```bash
# All services
docker-compose logs

# Specific service
docker-compose logs superset

# Follow logs
docker-compose logs -f superset

# Last 100 lines
docker-compose logs --tail=100 superset
```

**Execute Commands**:
```bash
# Shell in container
docker-compose exec superset bash

# Run Superset CLI
docker-compose exec superset superset db upgrade
docker-compose exec superset superset init
```

---

## 9. Production Considerations

### 9.1 Security

**⚠️ Important**: Docker Compose files are **NOT for production**!

**Warnings in files**:
- All compose files include warnings about production use
- Default passwords in `.env` files
- Development-focused configurations

**Production Recommendations**:
- Use Kubernetes/Helm charts
- Use official production Docker images
- Set strong passwords and SECRET_KEY
- Enable SSL/TLS
- Use proper secrets management
- Configure proper resource limits
- Set up monitoring and logging

### 9.2 Resource Requirements

**Development**:
- RAM: 8GB+ recommended
- Disk: 10GB+ for images and volumes
- CPU: 2+ cores

**Production**:
- RAM: 16GB+ recommended
- Disk: 50GB+ for data
- CPU: 4+ cores

### 9.3 Scaling

**Horizontal Scaling**:
- Multiple worker instances
- Load balancer (nginx)
- Shared Redis and database
- Stateless application servers

**Vertical Scaling**:
- Increase worker concurrency
- Increase database connections
- Add Redis memory

---

## 10. File Comparison Matrix

| Feature | docker-compose.yml | docker-compose-non-dev.yml | docker-compose-light.yml | docker-compose.custom.yml | docker-compose-image-tag.yml |
|---------|-------------------|---------------------------|-------------------------|--------------------------|----------------------------|
| **Purpose** | Full dev stack | Production-like | Lightweight/multi-instance | Custom image | Tagged releases |
| **Source Mounting** | ✅ Yes | ❌ No | ✅ Yes | ❌ No | ❌ No |
| **Webpack Dev Server** | ✅ Yes | ❌ No | ✅ Yes | ❌ No | ❌ No |
| **WebSocket** | ✅ Yes | ❌ No | ❌ No | ❌ No | ❌ No |
| **Nginx** | ✅ Yes | ❌ No | ❌ No | ❌ No | ❌ No |
| **Redis** | ✅ Yes | ✅ Yes | ❌ No | ✅ Yes | ✅ Yes |
| **Build from Source** | ✅ Yes | ✅ Yes | ✅ Yes | ❌ No | ❌ No |
| **Gunicorn** | ❌ No | ✅ Yes | ❌ No | ❌ No | ✅ Yes |
| **Test Runner** | ✅ Optional | ❌ No | ✅ Yes | ❌ No | ❌ No |
| **Multi-Instance** | ❌ No | ❌ No | ✅ Yes | ❌ No | ❌ No |

---

## 11. Best Practices

### 11.1 Development

1. Use `docker-compose.yml` for full development
2. Create `docker/.env-local` for local overrides
3. Use `docker-compose-light.yml` for testing
4. Keep volumes for hot-reload
5. Use webpack dev server for frontend

### 11.2 Testing

1. Use `docker-compose-light.yml` with test profile
2. Isolate test databases
3. Use `FORCE_RELOAD=true` for clean state
4. Run tests in parallel with different project names

### 11.3 Production

1. **Don't use Docker Compose for production**
2. Use Kubernetes/Helm charts
3. Use official production images
4. Set proper resource limits
5. Configure health checks
6. Use secrets management
7. Enable monitoring

---

## 12. Summary

**Docker Compose Files**:
1. **`docker-compose.yml`** - Full development environment
2. **`docker-compose-non-dev.yml`** - Production-like (no dev volumes)
3. **`docker-compose-light.yml`** - Lightweight, multi-instance, testing
4. **`docker-compose.custom.yml`** - Pre-built custom image
5. **`docker-compose-image-tag.yml`** - Tagged release images

**Key Takeaways**:
- All files support environment variable overrides
- Development files mount source code for hot-reload
- Production-like files use built images
- Lightweight file supports multiple instances
- **None are recommended for production use**

**Next Steps**:
- For development: Use `docker-compose.yml`
- For testing: Use `docker-compose-light.yml`
- For production: Use Kubernetes/Helm charts

