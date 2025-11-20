#!/bin/bash
#
# Quick update script for Superset after code changes
# For Linux servers
# Usage: ./update-superset.sh
#

set -e

# Detect docker compose command (newer: docker compose, older: docker-compose)
if docker compose version > /dev/null 2>&1; then
    DOCKER_COMPOSE="docker compose"
elif docker-compose version > /dev/null 2>&1; then
    DOCKER_COMPOSE="docker-compose"
else
    echo "Error: Neither 'docker compose' nor 'docker-compose' found!"
    echo "Please install Docker Compose:"
    echo "  sudo apt install docker-compose"
    echo "  OR"
    echo "  sudo apt install docker-compose-plugin"
    exit 1
fi

echo "=========================================="
echo "Updating Superset"
echo "=========================================="
echo "Using: $DOCKER_COMPOSE"
echo ""

# Check if we're in the right directory
if [ ! -f "Dockerfile" ]; then
    echo "Error: Dockerfile not found. Please run this script from the Superset root directory."
    exit 1
fi

# Step 1: Pull latest code
echo "Step 1: Pulling latest code..."
git pull

if [ $? -ne 0 ]; then
    echo "Warning: Git pull failed or no changes. Continuing anyway..."
fi

echo ""

# Step 2: Rebuild image
echo "Step 2: Building new Docker image..."
echo "This will take 15-30 minutes..."
echo ""

docker build \
  --target lean \
  --tag superset-custom:latest \
  --build-arg BUILD_TRANSLATIONS=false \
  --build-arg DEV_MODE=false \
  --progress=plain \
  .

if [ $? -ne 0 ]; then
    echo ""
    echo "Error: Docker build failed!"
    exit 1
fi

echo ""
echo "Build completed successfully!"
echo ""

# Step 3: Restart services
echo "Step 3: Restarting services..."
$DOCKER_COMPOSE -f docker-compose.custom.yml down
$DOCKER_COMPOSE -f docker-compose.custom.yml up -d

if [ $? -ne 0 ]; then
    echo ""
    echo "Error: Failed to restart services!"
    exit 1
fi

echo ""
echo "=========================================="
echo "Update Complete!"
echo "=========================================="
echo ""
echo "Services are restarting. Monitor with:"
echo "  $DOCKER_COMPOSE -f docker-compose.custom.yml logs -f"
echo ""
echo "Check status:"
echo "  $DOCKER_COMPOSE -f docker-compose.custom.yml ps"
echo ""

