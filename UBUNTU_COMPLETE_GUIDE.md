# Complete Ubuntu Setup Guide - No Manual Steps

This guide provides a **single script** that does everything automatically.

## Prerequisites (One-time setup on Ubuntu)

### 1. Install Docker and Docker Compose

```bash
# Update system
sudo apt update

# Install Docker
sudo apt install -y docker.io docker-compose

# Add your user to docker group (so you don't need sudo)
sudo usermod -aG docker $USER

# Log out and log back in (or run: newgrp docker)
```

### 2. Clone Your Repository

```bash
# Clone your GitHub repository
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
cd YOUR_REPO
```

## Build and Run (Single Command)

That's it! Just run:

```bash
# Make the script executable
chmod +x build-and-run-ubuntu.sh

# Run it - it does EVERYTHING
./build-and-run-ubuntu.sh
```

## What the Script Does Automatically

1. ✅ **Checks prerequisites** (Docker installed, user in docker group)
2. ✅ **Builds the Docker image** (includes all your customizations)
3. ✅ **Creates docker-compose.yml** (with auto-generated secret key)
4. ✅ **Starts database and Redis**
5. ✅ **Initializes Superset database**
6. ✅ **Creates admin user** (admin/admin)
7. ✅ **Initializes Superset**
8. ✅ **Starts all services**

**Total time:** ~25-35 minutes (mostly the Docker build)

## After Running

Once the script completes:

1. **Wait 30-60 seconds** for services to start
2. **Access Superset:** `http://your-server-ip:8088`
3. **Login:** `admin` / `admin`

## Useful Commands

```bash
# View logs
docker compose -f docker-compose.production.yml logs -f

# Stop everything
docker compose -f docker-compose.production.yml down

# Start again (after stopping)
docker compose -f docker-compose.production.yml up -d

# Restart Superset
docker compose -f docker-compose.production.yml restart superset

# Check status
docker compose -f docker-compose.production.yml ps
```

## Updating Your Code

When you push new changes to GitHub:

```bash
# Pull latest code
git pull

# Rebuild and restart
./build-and-run-ubuntu.sh
```

The script will:
- Rebuild the image with new changes
- Restart services automatically

## Troubleshooting

### "Permission denied" error

```bash
# Add user to docker group
sudo usermod -aG docker $USER
# Log out and back in
```

### "Docker not found"

```bash
sudo apt update
sudo apt install -y docker.io docker-compose
```

### Port 8088 already in use

```bash
# Find what's using the port
sudo netstat -tulpn | grep 8088

# Or change the port in docker-compose.production.yml
# Change "8088:8088" to "8089:8088"
```

### Build fails

- Check you have enough disk space: `df -h` (need ~10GB free)
- Check you have enough RAM: `free -h` (need ~4GB free)
- Check Docker is running: `sudo systemctl status docker`

### Can't access Superset

```bash
# Check if containers are running
docker compose -f docker-compose.production.yml ps

# Check logs
docker compose -f docker-compose.production.yml logs superset

# Check if port is open
sudo ufw allow 8088/tcp
```

## What's Included in Your Custom Image

✅ **3D Model Viewer Component** - Displays GLTF/GLB/OBJ models  
✅ **Enhanced Button Component** - With external API proxy support  
✅ **Backend API Proxy** - `/api/v1/proxy/` endpoint  
✅ **CSP Configuration** - Updated for external resources  
✅ **All your customizations** - Everything from your codebase

## Summary

**Just run one command:**
```bash
./build-and-run-ubuntu.sh
```

That's it! The script handles everything automatically.

