# Build and Deploy Custom Superset to Ubuntu Server

This guide walks you through building your customized Superset Docker image and deploying it to your Ubuntu server.

## Prerequisites

### On Your Windows Machine (Build Machine)
- Docker Desktop installed and running
- Git repository with all customizations committed
- At least 8GB RAM available for Docker
- 10-15GB free disk space

### On Your Ubuntu Server
- Docker installed (`sudo apt install docker.io` or Docker Engine)
- Docker Compose installed (`sudo apt install docker-compose` or `docker compose` plugin)
- At least 4GB RAM available
- 10GB free disk space

## Step 1: Build Docker Image on Windows

### Option A: Using the Build Script (Easiest)

If you're on Windows, use the batch script:

```cmd
# From the Superset root directory
build-production-docker.bat superset-custom:latest
```

### Option B: Manual Build Command

```cmd
# From the Superset root directory
docker build ^
  --target lean ^
  --tag superset-custom:latest ^
  --build-arg BUILD_TRANSLATIONS=false ^
  --build-arg DEV_MODE=false ^
  --progress=plain ^
  .
```

**Build time:** This will take 15-30 minutes depending on your system.

**What happens during build:**
1. Installs Node.js dependencies (including `@google/model-viewer`)
2. Builds frontend assets with webpack (includes your custom components)
3. Installs Python dependencies
4. Copies all your custom code into the image
5. Creates optimized production image

## Step 2: Verify the Image

After the build completes, verify it was created:

```cmd
docker images | findstr superset-custom
```

You should see:
```
superset-custom   latest   <image-id>   <size>   <time>
```

## Step 3: Save the Docker Image

Export the image to a file that can be transferred to Ubuntu:

```cmd
# Save the image to a tar file
docker save -o superset-custom-latest.tar superset-custom:latest
```

This creates a file `superset-custom-latest.tar` in your current directory.

**File size:** The tar file will be 2-4GB depending on your build.

## Step 4: Transfer to Ubuntu Server

### Option A: Using SCP (Secure Copy)

From your Windows machine (using PowerShell or Git Bash):

```bash
# Replace with your Ubuntu server details
scp superset-custom-latest.tar username@your-ubuntu-server-ip:/home/username/
```

Example:
```bash
scp superset-custom-latest.tar ubuntu@192.168.1.100:/home/ubuntu/
```

### Option B: Using WinSCP (Windows GUI)

1. Download and install WinSCP
2. Connect to your Ubuntu server
3. Drag and drop `superset-custom-latest.tar` to the server

### Option C: Using USB Drive

1. Copy `superset-custom-latest.tar` to a USB drive
2. Transfer to Ubuntu server
3. Copy to desired location on Ubuntu

## Step 5: Load Image on Ubuntu Server

SSH into your Ubuntu server:

```bash
ssh username@your-ubuntu-server-ip
```

Load the Docker image:

```bash
# Navigate to where you saved the tar file
cd ~

# Load the image
docker load -i superset-custom-latest.tar

# Verify it loaded
docker images | grep superset-custom
```

You should see:
```
superset-custom   latest   <image-id>   <size>   <time>
```

## Step 6: Create Docker Compose File on Ubuntu

Create a production docker-compose file on your Ubuntu server:

```bash
# Create a directory for Superset
mkdir -p ~/superset-production
cd ~/superset-production

# Create docker-compose.yml
nano docker-compose.yml
```

Paste this configuration:

```yaml
version: '3.8'

services:
  db:
    image: postgres:15
    container_name: superset_db
    environment:
      POSTGRES_USER: superset
      POSTGRES_PASSWORD: superset
      POSTGRES_DB: superset
    volumes:
      - superset_db_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U superset"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: superset_redis
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  superset:
    image: superset-custom:latest
    container_name: superset_app
    ports:
      - "8088:8088"
    environment:
      SUPERSET_CONFIG_PATH: /app/superset/superset_config.py
      SUPERSET_SECRET_KEY: 'your-secret-key-change-this-to-random-string'
      DATABASE_URL: postgresql://superset:superset@db:5432/superset
      REDIS_URL: redis://redis:6379/0
      SUPERSET_LOAD_EXAMPLES: "false"
    volumes:
      - superset_home:/app/superset_home
      - superset_data:/app/data
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped

volumes:
  superset_db_data:
  superset_home:
  superset_data:
```

**Important:** Change `SUPERSET_SECRET_KEY` to a random string. Generate one:

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

Save the file (Ctrl+X, then Y, then Enter).

## Step 7: Initialize and Start Superset

### Initialize the database:

```bash
# Start services
docker compose up -d db redis

# Wait for database to be ready (about 10 seconds)
sleep 10

# Initialize Superset database
docker compose run --rm superset superset db upgrade

# Create admin user (replace with your credentials)
docker compose run --rm superset superset fab create-admin \
  --username admin \
  --firstname Admin \
  --lastname User \
  --email admin@example.com \
  --password admin

# Initialize Superset
docker compose run --rm superset superset init
```

### Start all services:

```bash
docker compose up -d
```

## Step 8: Verify Deployment

Check that all containers are running:

```bash
docker compose ps
```

You should see:
```
NAME            STATUS          PORTS
superset_app    Up (healthy)    0.0.0.0:8088->8088/tcp
superset_db     Up (healthy)    5432/tcp
superset_redis  Up (healthy)    6379/tcp
```

Access Superset:
- Open browser: `http://your-ubuntu-server-ip:8088`
- Login with: `admin` / `admin` (or credentials you set)

## Step 9: Test Your Customizations

1. **Test 3D Model Component:**
   - Create a new dashboard
   - Add a "3D Model" component
   - Enter a GLTF/GLB URL
   - Verify it loads

2. **Test Button Component:**
   - Add a "Button" component
   - Configure API endpoint
   - Test external API calls

## Troubleshooting

### Image won't load on Ubuntu

```bash
# Check Docker is running
sudo systemctl status docker

# Check available space
df -h

# Try loading with verbose output
docker load -i superset-custom-latest.tar --verbose
```

### Containers won't start

```bash
# Check logs
docker compose logs superset
docker compose logs db

# Check if ports are in use
sudo netstat -tulpn | grep 8088
```

### Frontend assets not loading

```bash
# Verify the build included frontend assets
docker run --rm superset-custom:latest ls -la /app/superset/static/assets/
```

### Database connection errors

```bash
# Check database is accessible
docker compose exec db psql -U superset -d superset -c "SELECT 1;"
```

### Permission issues

```bash
# Fix Docker permissions (if needed)
sudo usermod -aG docker $USER
newgrp docker
```

## Updating Your Custom Image

When you make changes:

1. **On Windows:**
   ```cmd
   # Rebuild
   build-production-docker.bat superset-custom:latest
   
   # Save
   docker save -o superset-custom-latest.tar superset-custom:latest
   ```

2. **Transfer to Ubuntu** (same as Step 4)

3. **On Ubuntu:**
   ```bash
   # Stop services
   docker compose down
   
   # Remove old image
   docker rmi superset-custom:latest
   
   # Load new image
   docker load -i superset-custom-latest.tar
   
   # Restart
   docker compose up -d
   ```

## Alternative: Using Docker Registry

If you prefer using a Docker registry (Docker Hub, GitHub Container Registry, etc.):

### Push from Windows:

```cmd
# Tag for registry
docker tag superset-custom:latest your-registry/superset-custom:latest

# Login to registry
docker login your-registry

# Push
docker push your-registry/superset-custom:latest
```

### Pull on Ubuntu:

```bash
# Login
docker login your-registry

# Pull
docker pull your-registry/superset-custom:latest

# Update docker-compose.yml to use:
# image: your-registry/superset-custom:latest
```

## Production Recommendations

1. **Use a reverse proxy** (nginx) for HTTPS
2. **Set up SSL certificates** (Let's Encrypt)
3. **Configure firewall** (UFW) to allow only necessary ports
4. **Set up backups** for the database volume
5. **Use environment variables** for secrets (don't hardcode in docker-compose.yml)
6. **Monitor logs** regularly
7. **Set up log rotation**

## Quick Reference Commands

```bash
# View logs
docker compose logs -f superset

# Restart services
docker compose restart

# Stop services
docker compose down

# Start services
docker compose up -d

# Execute commands in container
docker compose exec superset superset <command>

# Backup database
docker compose exec db pg_dump -U superset superset > backup.sql

# Restore database
docker compose exec -T db psql -U superset superset < backup.sql
```

## Summary

1. ✅ Build image on Windows: `build-production-docker.bat`
2. ✅ Save image: `docker save -o superset-custom-latest.tar`
3. ✅ Transfer to Ubuntu: `scp` or WinSCP
4. ✅ Load on Ubuntu: `docker load -i superset-custom-latest.tar`
5. ✅ Create docker-compose.yml
6. ✅ Initialize and start: `docker compose up -d`
7. ✅ Access at `http://your-server-ip:8088`

Your customizations (3D Model Viewer, Button API Proxy, CSP changes) are all included in the image!

