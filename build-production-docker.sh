#!/bin/bash
#
# Script to build a production Docker image for customized Superset
# Usage: ./build-production-docker.sh [tag]
#

set -e

# Default tag
TAG=${1:-superset-custom:latest}

echo "=========================================="
echo "Building Superset Production Docker Image"
echo "=========================================="
echo "Tag: $TAG"
echo ""

# Check if we're in the right directory
if [ ! -f "Dockerfile" ]; then
    echo "Error: Dockerfile not found. Please run this script from the Superset root directory."
    exit 1
fi

# Check if package.json has @google/model-viewer
if ! grep -q "@google/model-viewer" superset-frontend/package.json; then
    echo "Warning: @google/model-viewer not found in package.json"
    echo "This may cause the 3D Model component to fail."
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo "Building Docker image..."
echo "This may take 15-30 minutes depending on your system..."
echo ""

# Build the image
docker build \
    --target lean \
    --tag "$TAG" \
    --build-arg BUILD_TRANSLATIONS=false \
    --build-arg DEV_MODE=false \
    --progress=plain \
    .

echo ""
echo "=========================================="
echo "Build completed successfully!"
echo "=========================================="
echo ""
echo "Image tagged as: $TAG"
echo ""
echo "To test the image locally:"
echo "  docker run -p 8088:8088 $TAG"
echo ""
echo "To push to a registry:"
echo "  docker tag $TAG your-registry/$TAG"
echo "  docker push your-registry/$TAG"
echo ""

