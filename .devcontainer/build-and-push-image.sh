#!/bin/bash
# Script to build and push the devcontainer image to GitHub Container Registry
# This allows caching the image between Codespace sessions

# You'll need to run this with appropriate GitHub permissions
# gh auth login --scopes write:packages

REGISTRY="ghcr.io"
OWNER="apache"
REPO="superset"
TAG="devcontainer-base"

echo "Building devcontainer image..."
docker build -t $REGISTRY/$OWNER/$REPO:$TAG .devcontainer/

echo "Pushing to GitHub Container Registry..."
docker push $REGISTRY/$OWNER/$REPO:$TAG

echo "Done! Update .devcontainer/devcontainer.json to use:"
echo "  \"image\": \"$REGISTRY/$OWNER/$REPO:$TAG\""
