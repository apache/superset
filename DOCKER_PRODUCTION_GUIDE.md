# Docker Production Deployment Guide for Customized Superset

This guide explains how to build and deploy your customized Superset (with 3D Model Viewer and Button API Proxy) to Docker for production.

## Overview of Customizations

Your customized Superset includes:
1. **3D Model Viewer Component** - Displays GLTF/GLB/OBJ 3D models in dashboards
2. **Enhanced Button Component** - Supports external API calls via backend proxy
3. **Backend API Proxy** - `/api/v1/proxy/` endpoint for bypassing CSP restrictions
4. **CSP Configuration** - Updated Content Security Policy to allow external API calls

## Prerequisites

- Docker and Docker Compose installed
- Git repository with all your customizations committed
- At least 8GB RAM available for Docker build
- Sufficient disk space (build can use 5-10GB)

## Step 1: Verify Your Customizations

Ensure all your changes are committed:

```bash
# Check that these files are modified:
# - superset-frontend/src/dashboard/components/gridComponents/Model3D/Model3D.tsx
# - superset-frontend/src/dashboard/components/gridComponents/Button/Button.tsx
# - superset/config.py (CSP changes)
# - superset/views/api.py (proxy endpoint)
# - superset-frontend/package.json (should include @google/model-viewer)
```

## Step 2: Build Production Docker Image

### Option A: Build from Your Local Codebase (Recommended)

Build a production image with the `lean` target:

```bash
# From the root of your Superset repository
docker build \
  --target lean \
  --tag superset-custom:latest \
  --build-arg BUILD_TRANSLATIONS=false \
  --build-arg DEV_MODE=false \
  .
```

**Build arguments explained:**
- `--target lean`: Builds the production-ready "lean" image (smaller, optimized)
- `--tag superset-custom:latest`: Tags your image with a custom name
- `--build-arg BUILD_TRANSLATIONS=false`: Skips translation compilation (faster build)
- `--build-arg DEV_MODE=false`: Ensures frontend assets are built for production

### Option B: Build with Translations

If you need translations:

```bash
docker build \
  --target lean \
  --tag superset-custom:latest \
  --build-arg BUILD_TRANSLATIONS=true \
  --build-arg DEV_MODE=false \
  .
```

### Option C: Build with Playwright (for Alerts & Reports)

If you need screenshot capabilities for Alerts & Reports:

```bash
docker build \
  --target lean \
  --tag superset-custom:latest \
  --build-arg BUILD_TRANSLATIONS=false \
  --build-arg DEV_MODE=false \
  --build-arg INCLUDE_CHROMIUM=true \
  .
```

**Note:** The build process will:
1. Install all npm dependencies (including `@google/model-viewer`)
2. Build frontend assets with webpack (includes your custom components)
3. Install Python dependencies
4. Copy all your custom code into the image

## Step 3: Create a Custom Dockerfile (Optional but Recommended)

For production, create a custom Dockerfile that extends the lean image and adds any additional dependencies:

```dockerfile
# Dockerfile.production
FROM superset-custom:latest

USER root

# Install any additional Python packages you need
RUN . /app/.venv/bin/activate && \
    uv pip install \
    # Add your database drivers here, e.g.:
    # psycopg2-binary \  # For PostgreSQL
    # pymssql \          # For SQL Server
    # mysqlclient \      # For MySQL
    # Add any other packages you need
    requests \  # Already included, but shown as example
    && echo "Custom packages installed"

# Copy any custom configuration files if needed
# COPY superset_config_docker.py /app/superset/superset_config_docker.py

# Switch back to superset user
USER superset

CMD ["/app/docker/entrypoints/run-server.sh"]
```

Then build:

```bash
docker build -f Dockerfile.production -t superset-custom:production .
```

## Step 4: Create Production Docker Compose File

Create a `docker-compose.production.yml` file:

```yaml
version: '3.8'

services:
  db:
    image: postgres:16
    container_name: superset_db
    restart: unless-stopped
    environment:
      POSTGRES_USER: superset
      POSTGRES_PASSWORD: superset
      POSTGRES_DB: superset
    volumes:
      - db_home:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U superset"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7
    container_name: superset_cache
    restart: unless-stopped
    volumes:
      - redis:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  superset-init:
    image: superset-custom:production
    container_name: superset_init
    command: ["/app/docker/docker-init.sh"]
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      SUPERSET_SECRET_KEY: "your-secret-key-change-this"
      DATABASE_URL: "postgresql://superset:superset@db:5432/superset"
      REDIS_HOST: redis
      REDIS_PORT: 6379
    volumes:
      - superset_home:/app/superset_home

  superset:
    image: superset-custom:production
    container_name: superset_app
    command: ["/app/docker/docker-bootstrap.sh", "app-gunicorn"]
    restart: unless-stopped
    ports:
      - "8088:8088"
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
      superset-init:
        condition: service_completed_successfully
    environment:
      SUPERSET_SECRET_KEY: "your-secret-key-change-this"
      DATABASE_URL: "postgresql://superset:superset@db:5432/superset"
      REDIS_HOST: redis
      REDIS_PORT: 6379
      # Add your CSP configuration via environment variable if needed
      SUPERSET_ADDITIONAL_CONNECT_SOURCES: "https://app.idtcities.com,https://home.idtcities.com"
    volumes:
      - superset_home:/app/superset_home
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8088/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  superset-worker:
    image: superset-custom:production
    container_name: superset_worker
    command: ["/app/docker/docker-bootstrap.sh", "worker"]
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
      superset-init:
        condition: service_completed_successfully
    environment:
      SUPERSET_SECRET_KEY: "your-secret-key-change-this"
      DATABASE_URL: "postgresql://superset:superset@db:5432/superset"
      REDIS_HOST: redis
      REDIS_PORT: 6379
    volumes:
      - superset_home:/app/superset_home

volumes:
  db_home:
  redis:
  superset_home:
```

## Step 5: Configure Environment Variables

Create a `.env` file for sensitive configuration:

```bash
# .env
SUPERSET_SECRET_KEY=your-very-secure-secret-key-here-change-this
DATABASE_URL=postgresql://superset:superset@db:5432/superset
REDIS_HOST=redis
REDIS_PORT=6379

# CSP Configuration (optional, already in config.py)
SUPERSET_ADDITIONAL_CONNECT_SOURCES=https://app.idtcities.com,https://home.idtcities.com
```

**Important:** Generate a secure SECRET_KEY:

```bash
# Generate a secure secret key
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

## Step 6: Deploy

### Start the services:

```bash
# Build the image first (if not already built)
docker build --target lean --tag superset-custom:production .

# Start all services
docker-compose -f docker-compose.production.yml up -d

# Check logs
docker-compose -f docker-compose.production.yml logs -f superset
```

### Verify deployment:

1. Check health: `curl http://localhost:8088/health`
2. Access Superset: `http://localhost:8088`
3. Login with default credentials: `admin/admin` (change immediately!)
4. Test your customizations:
   - Add a 3D Model component to a dashboard
   - Add a Button component with an external API call

## Step 7: Production Considerations

### Security

1. **Change default passwords** immediately after first login
2. **Use strong SECRET_KEY** - generate a new one for production
3. **Use environment variables** for sensitive config (don't hardcode)
4. **Enable HTTPS** - use a reverse proxy (nginx/traefik) with SSL certificates
5. **Restrict database access** - don't expose database ports publicly

### Performance

1. **Use a production database** - PostgreSQL or MySQL (not SQLite)
2. **Configure Redis** for caching and Celery
3. **Set up proper resource limits** in docker-compose.yml
4. **Use multiple workers** for Gunicorn in production

### Monitoring

1. **Set up health checks** (already included in docker-compose)
2. **Configure logging** - set `SUPERSET_LOG_LEVEL=info` or `debug`
3. **Monitor resource usage** - CPU, memory, disk

## Troubleshooting

### Build fails with npm errors

```bash
# Clear npm cache and rebuild
docker system prune -a
docker build --no-cache --target lean --tag superset-custom:latest .
```

### Frontend assets not loading

- Check that `DEV_MODE=false` during build
- Verify webpack build completed successfully
- Check browser console for 404 errors

### 3D models not loading

- Verify `@google/model-viewer` is in package.json (already included)
- Check browser console for CORS errors
- Ensure model URLs are accessible

### API proxy not working

- Verify `/api/v1/proxy/` endpoint is accessible
- Check backend logs: `docker logs superset_app`
- Verify CSP configuration in `superset/config.py`

### Database connection issues

- Check database is running: `docker ps`
- Verify connection string in environment variables
- Check database logs: `docker logs superset_db`

## Updating Your Custom Image

When you make changes to your customizations:

```bash
# 1. Commit your changes
git add .
git commit -m "Update customizations"

# 2. Rebuild the image
docker build --target lean --tag superset-custom:production .

# 3. Restart services
docker-compose -f docker-compose.production.yml up -d --force-recreate superset
```

## Additional Resources

- [Superset Docker Builds Documentation](https://superset.apache.org/docs/installation/docker-builds/)
- [Superset Production Deployment](https://superset.apache.org/docs/installation/installation-methods/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)

## Summary

Your customizations are automatically included in the Docker build because:
1. All frontend code is copied and built during the Docker build process
2. All backend code (including `config.py` and `api.py`) is included in the image
3. npm dependencies (like `@google/model-viewer`) are installed during build
4. The webpack build process bundles all your custom components

The key is to build with `--target lean` and `DEV_MODE=false` to ensure production-ready assets are created.

