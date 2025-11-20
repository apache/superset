#!/bin/bash
#
# Quick fix for DuckDB error - Skip loading examples
# For Linux servers
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
echo "Fixing DuckDB Error - Skipping Examples"
echo "=========================================="
echo "Using: $DOCKER_COMPOSE"
echo ""

# Create .env-local if it doesn't exist
if [ ! -f "docker/.env-local" ]; then
    echo "Creating docker/.env-local..."
    mkdir -p docker
    touch docker/.env-local
fi

# Check if SUPERSET_LOAD_EXAMPLES is already set
if grep -q "SUPERSET_LOAD_EXAMPLES" docker/.env-local; then
    echo "Updating SUPERSET_LOAD_EXAMPLES in docker/.env-local..."
    sed -i 's/^SUPERSET_LOAD_EXAMPLES=.*/SUPERSET_LOAD_EXAMPLES=no/' docker/.env-local
else
    echo "Adding SUPERSET_LOAD_EXAMPLES=no to docker/.env-local..."
    echo "" >> docker/.env-local
    echo "# Skip loading examples (avoids DuckDB requirement)" >> docker/.env-local
    echo "SUPERSET_LOAD_EXAMPLES=no" >> docker/.env-local
fi

echo ""
echo "✅ Configuration updated!"
echo ""
echo "Restarting services..."
echo ""

# Restart the init container to apply changes
$DOCKER_COMPOSE -f docker-compose.custom.yml down
$DOCKER_COMPOSE -f docker-compose.custom.yml up -d

echo ""
echo "=========================================="
echo "Fix Applied!"
echo "=========================================="
echo ""
echo "Services are restarting. Check logs with:"
echo "  $DOCKER_COMPOSE -f docker-compose.custom.yml logs -f superset-init"
echo ""
echo "Once initialization completes, access Superset at:"
echo "  http://localhost:8088"
echo ""
echo "To monitor initialization progress:"
echo "  $DOCKER_COMPOSE -f docker-compose.custom.yml logs -f superset-init | grep -E 'Step|Complete|Error'"
echo ""

