#!/bin/bash
#
# Build custom Superset image and run it with docker-compose
# Usage: ./build-and-use-custom.sh
#

set -e

echo "=========================================="
echo "Building Custom Superset Image"
echo "=========================================="
echo ""

# Check if we're in the right directory
if [ ! -f "Dockerfile" ]; then
    echo "Error: Dockerfile not found. Please run from Superset root directory."
    exit 1
fi

# Build the image
echo "Building Docker image (this takes 20-30 minutes)..."
docker build \
  --target lean \
  --tag superset-custom:latest \
  --build-arg BUILD_TRANSLATIONS=false \
  --build-arg DEV_MODE=false \
  --progress=plain \
  .

if [ $? -ne 0 ]; then
    echo ""
    echo "Error: Build failed!"
    exit 1
fi

echo ""
echo "Build completed successfully!"
echo ""

# Check if docker-compose.custom.yml exists
if [ ! -f "docker-compose.custom.yml" ]; then
    echo "Warning: docker-compose.custom.yml not found"
    echo "You can create it or modify your existing docker-compose.yml"
    echo "to use: image: superset-custom:latest"
    exit 1
fi

# Stop existing containers
echo "Stopping existing containers..."
docker compose down 2>/dev/null || true
docker compose -f docker-compose.custom.yml down 2>/dev/null || true

echo ""
echo "Starting Superset with custom image..."
docker compose -f docker-compose.custom.yml up -d

echo ""
echo "=========================================="
echo "Setup completed!"
echo "=========================================="
echo ""
echo "Superset is starting..."
echo "Wait 30-60 seconds, then access:"
echo "  http://localhost:8088"
echo ""
echo "To view logs:"
echo "  docker compose -f docker-compose.custom.yml logs -f"
echo ""
echo "To stop:"
echo "  docker compose -f docker-compose.custom.yml down"
echo ""

