# Build and Run Custom Superset Image with Docker Compose

This guide shows you how to build your customized Superset Docker image and run it using Docker Compose.

## Quick Start

```bash
# 1. Build the image
docker build --target lean --tag superset-custom:latest --build-arg BUILD_TRANSLATIONS=false --build-arg DEV_MODE=false .

# 2. Run with Docker Compose
docker-compose -f docker-compose.custom.yml up -d

# 3. Access Superset
# Open http://localhost:8088 in your browser
```

---

## Step-by-Step Instructions

### Step 1: Build Your Custom Docker Image

Build a production-ready image with all your customizations:

#### On Windows (PowerShell/CMD):

```cmd
docker build ^
  --target lean ^
  --tag superset-custom:latest ^
  --build-arg BUILD_TRANSLATIONS=false ^
  --build-arg DEV_MODE=false ^
  --progress=plain ^
  .
```

#### On Linux/Mac:

```bash
docker build \
  --target lean \
  --tag superset-custom:latest \
  --build-arg BUILD_TRANSLATIONS=false \
  --build-arg DEV_MODE=false \
  --progress=plain \
  .
```

**Build Arguments Explained:**
- `--target lean`: Builds the production-ready "lean" image (optimized, smaller)
- `--tag superset-custom:latest`: Tags your image (change `latest` to any version you want)
- `--build-arg BUILD_TRANSLATIONS=false`: Skips translation compilation (faster build)
- `--build-arg DEV_MODE=false`: Ensures frontend assets are built for production

**Build Time:** 15-30 minutes depending on your system

**What Gets Built:**
1. ✅ Installs all npm dependencies (including your custom packages)
2. ✅ Builds frontend assets with webpack (includes your custom components)
3. ✅ Installs Python dependencies
4. ✅ Copies all your custom code into the image
5. ✅ Creates optimized production image

### Step 2: Verify the Image

Check that your image was created successfully:

```bash
docker images | grep superset-custom
```

You should see:
```
superset-custom   latest   <image-id>   <size>   <time>
```

### Step 3: Prepare Environment File

Create or update `docker/.env` file with your configuration:

```bash
# Database Configuration
POSTGRES_USER=superset
POSTGRES_PASSWORD=superset
POSTGRES_DB=superset
DATABASE_HOST=db
DATABASE_DB=superset

# Redis Configuration
REDIS_HOST=redis
REDIS_PORT=6379

# Superset Configuration
SECRET_KEY=your-secret-key-change-this-in-production
SUPERSET_CONFIG_PATH=/app/docker/pythonpath_dev/superset_config.py
```

**Important:** Change `SECRET_KEY` to a random secure value in production!

### Step 4: Run with Docker Compose

Start all services:

```bash
docker-compose -f docker-compose.custom.yml up -d
```

**What This Starts:**
- ✅ PostgreSQL database (metadata storage)
- ✅ Redis (caching and message broker)
- ✅ Superset initialization (runs migrations, creates admin user)
- ✅ Superset application server (Gunicorn on port 8088)
- ✅ Celery worker (async tasks)
- ✅ Celery beat scheduler (scheduled reports/alerts)

### Step 5: Check Service Status

View running containers:

```bash
docker-compose -f docker-compose.custom.yml ps
```

View logs:

```bash
# All services
docker-compose -f docker-compose.custom.yml logs -f

# Specific service
docker-compose -f docker-compose.custom.yml logs -f superset

# Check initialization
docker-compose -f docker-compose.custom.yml logs superset-init
```

### Step 6: Access Superset

Once initialization completes (check logs), access Superset:

- **URL:** http://localhost:8088
- **Default credentials:**
  - Username: `admin`
  - Password: `admin` (change this immediately!)

---

## Advanced Options

### Build with Translations

If you need translation support:

```bash
docker build \
  --target lean \
  --tag superset-custom:latest \
  --build-arg BUILD_TRANSLATIONS=true \
  --build-arg DEV_MODE=false \
  .
```

### Build with Chromium (for Screenshots)

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

### Use Different Image Tag

Build with a version tag:

```bash
docker build \
  --target lean \
  --tag superset-custom:v1.0.0 \
  --build-arg BUILD_TRANSLATIONS=false \
  --build-arg DEV_MODE=false \
  .
```

Then update `docker-compose.custom.yml`:
```yaml
x-superset-image: &superset-image superset-custom:v1.0.0
```

### Custom Port

To use a different port, update `docker-compose.custom.yml`:

```yaml
superset:
  ports:
    - "9090:8088"  # Change 9090 to your desired port
```

---

## Service Management

### Stop Services

```bash
docker-compose -f docker-compose.custom.yml stop
```

### Start Services

```bash
docker-compose -f docker-compose.custom.yml start
```

### Restart Services

```bash
docker-compose -f docker-compose.custom.yml restart
```

### Stop and Remove Everything

```bash
docker-compose -f docker-compose.custom.yml down
```

### Stop and Remove with Volumes (⚠️ Deletes Data)

```bash
docker-compose -f docker-compose.custom.yml down -v
```

---

## Troubleshooting

### Image Not Found

**Error:** `Error response from daemon: pull access denied for superset-custom`

**Solution:** Make sure you built the image first:
```bash
docker build --target lean --tag superset-custom:latest --build-arg BUILD_TRANSLATIONS=false --build-arg DEV_MODE=false .
```

### Port Already in Use

**Error:** `Bind for 0.0.0.0:8088 failed: port is already allocated`

**Solution:** 
- Change the port in `docker-compose.custom.yml`
- Or stop the service using port 8088:
  ```bash
  # Find what's using the port
  netstat -ano | findstr :8088  # Windows
  lsof -i :8088                 # Linux/Mac
  ```

### Database Connection Errors

**Error:** `Connection refused` or database errors

**Solution:**
1. Check database is running:
   ```bash
   docker-compose -f docker-compose.custom.yml ps db
   ```
2. Check database logs:
   ```bash
   docker-compose -f docker-compose.custom.yml logs db
   ```
3. Verify credentials in `docker/.env`
4. Wait for `superset-init` to complete

### Initialization Fails

**Error:** `superset-init` exits with error

**Solution:**
1. Check initialization logs:
   ```bash
   docker-compose -f docker-compose.custom.yml logs superset-init
   ```
2. Ensure database is healthy:
   ```bash
   docker-compose -f docker-compose.custom.yml ps db
   ```
3. Try re-running initialization:
   ```bash
   docker-compose -f docker-compose.custom.yml run --rm superset-init
   ```

### Frontend Not Loading

**Symptoms:** Blank page or 404 errors

**Solution:**
1. Check Superset logs:
   ```bash
   docker-compose -f docker-compose.custom.yml logs superset
   ```
2. Verify frontend assets were built:
   ```bash
   docker-compose -f docker-compose.custom.yml exec superset ls -la /app/superset/static/assets/
   ```
3. Rebuild image if assets are missing

### Worker Not Starting

**Error:** Celery worker fails to start

**Solution:**
1. Check worker logs:
   ```bash
   docker-compose -f docker-compose.custom.yml logs superset-worker
   ```
2. Verify Redis connection:
   ```bash
   docker-compose -f docker-compose.custom.yml exec redis redis-cli ping
   ```
3. Check environment variables in `docker/.env`

---

## Updating Your Custom Image

When you make changes to your code:

### 1. Rebuild the Image

```bash
docker build \
  --target lean \
  --tag superset-custom:latest \
  --build-arg BUILD_TRANSLATIONS=false \
  --build-arg DEV_MODE=false \
  .
```

### 2. Restart Services

```bash
docker-compose -f docker-compose.custom.yml restart superset superset-worker superset-worker-beat
```

Or for a clean restart:

```bash
docker-compose -f docker-compose.custom.yml down
docker-compose -f docker-compose.custom.yml up -d
```

---

## Production Considerations

### ⚠️ Important Security Notes

1. **Change Default Passwords:**
   - Update `POSTGRES_PASSWORD` in `docker/.env`
   - Change admin password after first login

2. **Set Strong SECRET_KEY:**
   ```bash
   # Generate a secure key
   python -c "import secrets; print(secrets.token_urlsafe(32))"
   ```
   Add to `docker/.env`:
   ```
   SECRET_KEY=your-generated-secret-key-here
   ```

3. **Use Environment-Specific Config:**
   - Create `docker/.env-local` for local overrides
   - Never commit secrets to git

4. **Resource Limits:**
   Add to services in `docker-compose.custom.yml`:
   ```yaml
   deploy:
     resources:
       limits:
         cpus: '2'
         memory: 4G
       reservations:
         cpus: '1'
         memory: 2G
   ```

5. **Health Checks:**
   Already configured, but monitor them:
   ```bash
   docker-compose -f docker-compose.custom.yml ps
   ```

### Recommended for Production

- Use Kubernetes/Helm charts instead of Docker Compose
- Set up proper secrets management
- Enable SSL/TLS
- Configure backup strategy
- Set up monitoring and logging
- Use external PostgreSQL and Redis (not in containers)

---

## Quick Reference

### Build Commands

```bash
# Basic build
docker build --target lean --tag superset-custom:latest --build-arg BUILD_TRANSLATIONS=false --build-arg DEV_MODE=false .

# With translations
docker build --target lean --tag superset-custom:latest --build-arg BUILD_TRANSLATIONS=true --build-arg DEV_MODE=false .

# With Chromium
docker build --target lean --tag superset-custom:latest --build-arg BUILD_TRANSLATIONS=false --build-arg DEV_MODE=false --build-arg INCLUDE_CHROMIUM=true .
```

### Docker Compose Commands

```bash
# Start services
docker-compose -f docker-compose.custom.yml up -d

# View logs
docker-compose -f docker-compose.custom.yml logs -f

# Stop services
docker-compose -f docker-compose.custom.yml stop

# Stop and remove
docker-compose -f docker-compose.custom.yml down

# Restart services
docker-compose -f docker-compose.custom.yml restart

# Check status
docker-compose -f docker-compose.custom.yml ps
```

### Useful Docker Commands

```bash
# List images
docker images | grep superset-custom

# Remove old image
docker rmi superset-custom:latest

# Execute command in container
docker-compose -f docker-compose.custom.yml exec superset bash

# Run Superset CLI
docker-compose -f docker-compose.custom.yml exec superset superset db upgrade
docker-compose -f docker-compose.custom.yml exec superset superset init
```

---

## Summary

1. **Build:** `docker build --target lean --tag superset-custom:latest --build-arg BUILD_TRANSLATIONS=false --build-arg DEV_MODE=false .`
2. **Run:** `docker-compose -f docker-compose.custom.yml up -d`
3. **Access:** http://localhost:8088
4. **Logs:** `docker-compose -f docker-compose.custom.yml logs -f`

Your custom Superset image is now running with all your customizations! 🎉

