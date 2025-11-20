# Server Deployment Guide - Build and Run Custom Superset

This guide is for deploying your customized Superset on a Linux server.

## Workflow

1. **On Windows (Development):** Make changes, commit, push to Git
2. **On Server:** Pull changes, build Docker image, run with Docker Compose

---

## Step 1: Pull Latest Code on Server

```bash
# SSH into your server
ssh user@your-server

# Navigate to your Superset directory
cd /path/to/superset-1

# Pull latest changes
git pull origin main  # or your branch name
```

---

## Step 2: Build Custom Docker Image

### Quick Build Script

```bash
# Make script executable (first time only)
chmod +x build-and-run-custom.sh

# Build and run
./build-and-run-custom.sh superset-custom:latest
```

### Manual Build

```bash
# Build the production image
docker build \
  --target lean \
  --tag superset-custom:latest \
  --build-arg BUILD_TRANSLATIONS=false \
  --build-arg DEV_MODE=false \
  --progress=plain \
  .

# This takes 15-30 minutes
```

---

## Step 3: Fix DuckDB Issue (Skip Examples)

The `lean` image doesn't include DuckDB. Skip examples for production:

### Quick Fix Script

```bash
# Make script executable (first time only)
chmod +x fix-duckdb-issue.sh

# Apply the fix
./fix-duckdb-issue.sh
```

### Manual Fix

```bash
# Create or edit docker/.env-local
nano docker/.env-local

# Add this line:
SUPERSET_LOAD_EXAMPLES=no

# Save and exit (Ctrl+X, Y, Enter)

# Restart services
docker-compose -f docker-compose.custom.yml down
docker-compose -f docker-compose.custom.yml up -d
```

---

## Step 4: Run with Docker Compose

```bash
# Start all services
docker-compose -f docker-compose.custom.yml up -d

# Check status
docker-compose -f docker-compose.custom.yml ps

# View logs
docker-compose -f docker-compose.custom.yml logs -f
```

---

## Step 5: Monitor Initialization

```bash
# Watch initialization progress
docker-compose -f docker-compose.custom.yml logs -f superset-init

# Or filter for important messages
docker-compose -f docker-compose.custom.yml logs -f superset-init | grep -E 'Step|Complete|Error|Init'
```

**Wait for:** "Init Step 4/4 [Complete]" or "Init Step 4/4 [Skipped]"

---

## Step 6: Access Superset

Once initialization completes:

- **URL:** `http://your-server-ip:8088` or `http://your-domain:8088`
- **Username:** `admin`
- **Password:** `admin` (change immediately!)

---

## Complete Deployment Workflow

### First Time Setup

```bash
# 1. Clone/pull repository
cd /path/to/superset-1
git pull

# 2. Make scripts executable
chmod +x build-and-run-custom.sh fix-duckdb-issue.sh

# 3. Build image
./build-and-run-custom.sh

# 4. Fix DuckDB issue (skip examples)
./fix-duckdb-issue.sh

# 5. Access Superset
# Open http://your-server-ip:8088
```

### Subsequent Deployments (After Code Changes)

```bash
# 1. Pull latest code
cd /path/to/superset-1
git pull

# 2. Rebuild image (if code changed)
docker build \
  --target lean \
  --tag superset-custom:latest \
  --build-arg BUILD_TRANSLATIONS=false \
  --build-arg DEV_MODE=false \
  .

# 3. Restart services
docker-compose -f docker-compose.custom.yml down
docker-compose -f docker-compose.custom.yml up -d

# 4. Check logs
docker-compose -f docker-compose.custom.yml logs -f
```

---

## Useful Commands

### Service Management

```bash
# Start services
docker-compose -f docker-compose.custom.yml up -d

# Stop services
docker-compose -f docker-compose.custom.yml stop

# Stop and remove containers
docker-compose -f docker-compose.custom.yml down

# Restart services
docker-compose -f docker-compose.custom.yml restart

# Restart specific service
docker-compose -f docker-compose.custom.yml restart superset
```

### Logs

```bash
# All services
docker-compose -f docker-compose.custom.yml logs -f

# Specific service
docker-compose -f docker-compose.custom.yml logs -f superset
docker-compose -f docker-compose.custom.yml logs -f superset-worker

# Last 100 lines
docker-compose -f docker-compose.custom.yml logs --tail=100

# Since specific time
docker-compose -f docker-compose.custom.yml logs --since 10m
```

### Status

```bash
# Check running containers
docker-compose -f docker-compose.custom.yml ps

# Check resource usage
docker stats

# Check disk usage
docker system df
```

### Execute Commands in Container

```bash
# Shell access
docker-compose -f docker-compose.custom.yml exec superset bash

# Run Superset CLI commands
docker-compose -f docker-compose.custom.yml exec superset superset db upgrade
docker-compose -f docker-compose.custom.yml exec superset superset init
docker-compose -f docker-compose.custom.yml exec superset superset fab list-users
```

---

## Environment Configuration

### Create docker/.env File

```bash
# Create environment file
nano docker/.env

# Add these (adjust as needed):
POSTGRES_USER=superset
POSTGRES_PASSWORD=your-secure-password
POSTGRES_DB=superset
DATABASE_HOST=db
DATABASE_DB=superset

REDIS_HOST=redis
REDIS_PORT=6379

SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")

# Skip examples (avoids DuckDB requirement)
SUPERSET_LOAD_EXAMPLES=no
```

### Create docker/.env-local (Optional Overrides)

```bash
# For local/server-specific overrides
nano docker/.env-local

# Add any overrides here
# This file is git-ignored
```

---

## Troubleshooting

### Build Fails

```bash
# Check Docker has enough resources
docker system df

# Clean up old images/containers
docker system prune -a

# Check disk space
df -h

# Rebuild with more verbose output
docker build --target lean --tag superset-custom:latest --progress=plain --no-cache .
```

### Services Won't Start

```bash
# Check logs
docker-compose -f docker-compose.custom.yml logs

# Check if ports are in use
sudo netstat -tulpn | grep 8088
sudo netstat -tulpn | grep 5432

# Check Docker daemon
sudo systemctl status docker
```

### Database Connection Issues

```bash
# Check database is running
docker-compose -f docker-compose.custom.yml ps db

# Check database logs
docker-compose -f docker-compose.custom.yml logs db

# Test database connection
docker-compose -f docker-compose.custom.yml exec db psql -U superset -d superset -c "SELECT 1;"
```

### Initialization Fails

```bash
# Check init logs
docker-compose -f docker-compose.custom.yml logs superset-init

# Re-run initialization manually
docker-compose -f docker-compose.custom.yml run --rm superset-init

# If DuckDB error, ensure SUPERSET_LOAD_EXAMPLES=no is set
grep SUPERSET_LOAD_EXAMPLES docker/.env-local
```

---

## Updating After Code Changes

### Quick Update Script

Create `update-superset.sh`:

```bash
#!/bin/bash
set -e

echo "Updating Superset..."

# Pull latest code
git pull

# Rebuild image
echo "Building new image..."
docker build \
  --target lean \
  --tag superset-custom:latest \
  --build-arg BUILD_TRANSLATIONS=false \
  --build-arg DEV_MODE=false \
  .

# Restart services
echo "Restarting services..."
docker-compose -f docker-compose.custom.yml down
docker-compose -f docker-compose.custom.yml up -d

echo "Update complete! Check logs with:"
echo "  docker-compose -f docker-compose.custom.yml logs -f"
```

Make executable:
```bash
chmod +x update-superset.sh
```

Usage:
```bash
./update-superset.sh
```

---

## Production Considerations

### Security

1. **Change Default Passwords:**
   ```bash
   # Generate secure password
   openssl rand -base64 32
   
   # Update docker/.env
   POSTGRES_PASSWORD=your-generated-password
   SECRET_KEY=your-generated-secret-key
   ```

2. **Firewall:**
   ```bash
   # Only allow port 8088 from specific IPs
   sudo ufw allow from YOUR_IP to any port 8088
   ```

3. **SSL/TLS:**
   - Use nginx reverse proxy with Let's Encrypt
   - Don't expose port 8088 directly

### Resource Limits

Add to `docker-compose.custom.yml`:

```yaml
services:
  superset:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
        reservations:
          cpus: '1'
          memory: 2G
```

### Backup

```bash
# Backup database
docker-compose -f docker-compose.custom.yml exec db pg_dump -U superset superset > backup_$(date +%Y%m%d).sql

# Backup volumes
docker run --rm -v superset-1_db_home:/data -v $(pwd):/backup alpine tar czf /backup/db_backup_$(date +%Y%m%d).tar.gz /data
```

---

## Quick Reference

```bash
# Full deployment
git pull && ./build-and-run-custom.sh && ./fix-duckdb-issue.sh

# Update after code changes
git pull && docker build --target lean --tag superset-custom:latest --build-arg BUILD_TRANSLATIONS=false --build-arg DEV_MODE=false . && docker-compose -f docker-compose.custom.yml restart

# Check status
docker-compose -f docker-compose.custom.yml ps

# View logs
docker-compose -f docker-compose.custom.yml logs -f

# Stop everything
docker-compose -f docker-compose.custom.yml down

# Clean restart
docker-compose -f docker-compose.custom.yml down && docker-compose -f docker-compose.custom.yml up -d
```

---

## Summary

**Typical Server Workflow:**

1. `git pull` - Get latest code
2. `./build-and-run-custom.sh` - Build image
3. `./fix-duckdb-issue.sh` - Skip examples (fix DuckDB error)
4. `docker-compose -f docker-compose.custom.yml up -d` - Start services
5. Monitor logs until initialization completes
6. Access at `http://your-server-ip:8088`

All scripts are ready for Linux server use! 🚀

