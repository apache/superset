# Run Your Customized Superset in Docker

You have customized Superset code on Ubuntu and want to run it in Docker using your existing docker-compose.

## Quick Steps

### Step 1: Build Your Custom Docker Image

From your Superset root directory (where your customized code is):

```bash
# Build the production image with your customizations
docker build \
  --target lean \
  --tag superset-custom:latest \
  --build-arg BUILD_TRANSLATIONS=false \
  --build-arg DEV_MODE=false \
  .
```

**Time:** 20-30 minutes (first time)

This builds an image with all your customizations:
- ✅ 3D Model Viewer component
- ✅ Enhanced Button component  
- ✅ Backend API proxy
- ✅ CSP configuration changes

### Step 2: Update docker-compose.yml

You need to change your `docker-compose.yml` to use the **image** instead of **building** it.

**Option A: Create a new docker-compose file (Recommended)**

Create `docker-compose.custom.yml`:

```yaml
version: '3.8'

x-superset-user: &superset-user root
x-superset-volumes: &superset-volumes
  - superset_home:/app/superset_home
  - superset_data:/app/data

services:
  redis:
    image: redis:7
    container_name: superset_cache
    restart: unless-stopped
    volumes:
      - redis:/data

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

  superset-init:
    image: superset-custom:latest  # <-- Use your custom image
    container_name: superset_init
    command: ["/app/docker/docker-init.sh"]
    env_file:
      - path: docker/.env
        required: true
    depends_on:
      db:
        condition: service_started
      redis:
        condition: service_started
    user: *superset-user
    volumes: *superset-volumes

  superset:
    image: superset-custom:latest  # <-- Use your custom image
    container_name: superset_app
    command: ["/app/docker/docker-bootstrap.sh", "app"]
    restart: unless-stopped
    ports:
      - 8088:8088
    depends_on:
      superset-init:
        condition: service_completed_successfully
    user: *superset-user
    volumes: *superset-volumes
    env_file:
      - path: docker/.env
        required: true

volumes:
  superset_home:
  superset_data:
  db_home:
  redis:
```

**Option B: Modify existing docker-compose.yml**

In your existing `docker-compose.yml`, find the `superset` service and change:

**FROM:**
```yaml
superset:
  build:
    <<: *common-build
```

**TO:**
```yaml
superset:
  image: superset-custom:latest  # Use your custom image
  # Remove the build section
```

Do the same for `superset-init` service.

### Step 3: Run with Docker Compose

```bash
# Stop any existing containers
docker compose down

# Start with your custom image
docker compose -f docker-compose.custom.yml up -d

# Or if you modified the existing file:
docker compose up -d
```

### Step 4: Verify It's Running

```bash
# Check containers
docker compose ps

# Check logs
docker compose logs -f superset

# Access Superset
# http://localhost:8088
```

## Complete Example Script

Save this as `build-and-use-custom.sh`:

```bash
#!/bin/bash
set -e

echo "Building custom Superset image..."
docker build \
  --target lean \
  --tag superset-custom:latest \
  --build-arg BUILD_TRANSLATIONS=false \
  --build-arg DEV_MODE=false \
  .

echo ""
echo "Stopping existing containers..."
docker compose down

echo ""
echo "Starting with custom image..."
docker compose -f docker-compose.custom.yml up -d

echo ""
echo "Done! Superset is running at http://localhost:8088"
```

Make it executable and run:
```bash
chmod +x build-and-use-custom.sh
./build-and-use-custom.sh
```

## Updating Your Customizations

When you make changes to your code:

```bash
# 1. Rebuild the image
docker build --target lean --tag superset-custom:latest \
  --build-arg BUILD_TRANSLATIONS=false \
  --build-arg DEV_MODE=false .

# 2. Restart Superset
docker compose -f docker-compose.custom.yml restart superset
```

## Troubleshooting

### "Image not found"
- Make sure you built the image: `docker images | grep superset-custom`

### "Port already in use"
```bash
# Find what's using port 8088
sudo netstat -tulpn | grep 8088

# Stop existing Superset
docker compose down
```

### "Permission denied"
```bash
# Add user to docker group
sudo usermod -aG docker $USER
# Log out and back in
```

### Frontend not loading
- Make sure you built with `DEV_MODE=false`
- Check logs: `docker compose logs superset`
- Verify assets: `docker run --rm superset-custom:latest ls -la /app/superset/static/assets/`

## Summary

1. **Build:** `docker build --target lean --tag superset-custom:latest .`
2. **Update docker-compose:** Use `image: superset-custom:latest` instead of `build:`
3. **Run:** `docker compose -f docker-compose.custom.yml up -d`

That's it! Your customized Superset is now running in Docker.

