#!/bin/bash
#
# Quick script to build custom Superset image and run with Docker Compose
# For Linux servers
# Usage: ./build-and-run-custom.sh [image-tag]
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

IMAGE_TAG=${1:-superset-custom:latest}
COMPOSE_FILE="docker-compose.custom.yml"

echo "=========================================="
echo "Build and Run Custom Superset"
echo "=========================================="
echo "Image Tag: $IMAGE_TAG"
echo "Using: $DOCKER_COMPOSE"
echo ""

# Check if we're in the right directory
if [ ! -f "Dockerfile" ]; then
    echo "Error: Dockerfile not found. Please run this script from the Superset root directory."
    exit 1
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "Error: Docker is not running. Please start Docker and try again."
    exit 1
fi

# Step 1: Build the image
echo "Step 1: Building Docker image..."
echo "This will take 15-30 minutes. Please be patient..."
echo ""

docker build \
  --target lean \
  --tag "$IMAGE_TAG" \
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

# Step 2: Check if .env file exists
if [ ! -f "docker/.env" ]; then
    echo "Warning: docker/.env file not found."
    echo "Creating a basic .env file..."
    mkdir -p docker
    cat > docker/.env << EOF
POSTGRES_USER=superset
POSTGRES_PASSWORD=superset
POSTGRES_DB=superset
DATABASE_HOST=db
DATABASE_DB=superset
REDIS_HOST=redis
REDIS_PORT=6379
SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))" 2>/dev/null || echo "CHANGE-THIS-SECRET-KEY-IN-PRODUCTION")
EOF
    echo "Created docker/.env with default values."
    echo "⚠️  Please update SECRET_KEY and passwords before production use!"
    echo ""
fi

# Step 3: Stop any existing containers
echo "Step 2: Stopping any existing containers..."
$DOCKER_COMPOSE -f "$COMPOSE_FILE" down 2>/dev/null || true
echo ""

# Step 4: Start services
echo "Step 3: Starting services with Docker Compose..."
$DOCKER_COMPOSE -f "$COMPOSE_FILE" up -d

if [ $? -ne 0 ]; then
    echo ""
    echo "Error: Failed to start services!"
    exit 1
fi

echo ""
echo "=========================================="
echo "Services started successfully!"
echo "=========================================="
echo ""
echo "Waiting for initialization to complete..."
echo "This may take 1-2 minutes..."
echo ""

# Wait for initialization
sleep 5

# Check initialization status
echo "Checking initialization status..."
INIT_LOGS=$($DOCKER_COMPOSE -f "$COMPOSE_FILE" logs superset-init 2>/dev/null | tail -20)

if echo "$INIT_LOGS" | grep -q "Initialization complete\|Database initialized"; then
    echo "✅ Initialization appears complete!"
elif $DOCKER_COMPOSE -f "$COMPOSE_FILE" ps superset-init 2>/dev/null | grep -q "Exited (0)"; then
    echo "✅ Initialization container completed!"
else
    echo "⏳ Initialization still in progress..."
    echo "   Check logs with: $DOCKER_COMPOSE -f $COMPOSE_FILE logs -f superset-init"
fi

echo ""
echo "=========================================="
echo "Superset is starting up!"
echo "=========================================="
echo ""
echo "Access Superset at: http://localhost:8088"
echo ""
echo "Default credentials:"
echo "  Username: admin"
echo "  Password: admin"
echo ""
echo "⚠️  Change the admin password immediately after first login!"
echo ""
echo "Useful commands:"
echo "  View logs:        $DOCKER_COMPOSE -f $COMPOSE_FILE logs -f"
echo "  Stop services:    $DOCKER_COMPOSE -f $COMPOSE_FILE down"
echo "  Restart:          $DOCKER_COMPOSE -f $COMPOSE_FILE restart"
echo "  Check status:     $DOCKER_COMPOSE -f $COMPOSE_FILE ps"
echo ""

