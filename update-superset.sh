#!/bin/bash
#
# Quick update script for Superset after code changes
# For Linux servers
# Usage: ./update-superset.sh
#

set -e

echo "=========================================="
echo "Updating Superset"
echo "=========================================="
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
docker-compose -f docker-compose.custom.yml down
docker-compose -f docker-compose.custom.yml up -d

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
echo "  docker-compose -f docker-compose.custom.yml logs -f"
echo ""
echo "Check status:"
echo "  docker-compose -f docker-compose.custom.yml ps"
echo ""

