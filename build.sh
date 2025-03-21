#!/bin/bash
set -e  # Exit on error

# Get timestamp with milliseconds
DATE_WITH_TIME=$(date "+%Y%m%d.%H%M%S.%3N")

# Define image tag
IMAGE_TAG="registry.remita.net/systemspecs/remita-payment-services/technology/platform-engineering/core-platform/ramie-bi-data/apache-superset:${DATE_WITH_TIME}"

echo ">>> Building image: ${IMAGE_TAG}"

# Build for x86_64
echo ">>> Building for x86_64 architecture"

# Remove existing image if it exists
if docker inspect "${IMAGE_TAG}" >/dev/null 2>&1; then
    echo ">>> Removing existing image"
    docker rmi "${IMAGE_TAG}" || true
fi

# Build the image
echo ">>> Starting build process"
docker build \
    -f RemitaDockerfile \
    --platform=linux/amd64 \
    --build-arg NODE_OPTIONS="--max-old-space-size=8192" \
    -t "${IMAGE_TAG}" \
    --no-cache \
    .

docker push ${IMAGE_TAG}

# Verify build
if [ $? -eq 0 ]; then
    echo ">>> Build completed successfully"
    echo ">>> Image tag: ${IMAGE_TAG}"
    
    # Cleanup builder cache
    echo ">>> Cleaning up builder cache"
#    docker builder prune -f --filter until=24h

    # Optional: More aggressive cleanup
    # docker system prune -f --volumes

    # Uncomment to enable push
    # echo ">>> Pushing image to registry"
    # docker push "${IMAGE_TAG}"
else
    echo ">>> Build failed"
    exit 1
fi

# Print disk space after cleanup
echo ">>> Disk space after cleanup:"
df -h
