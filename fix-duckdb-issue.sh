#!/bin/bash
#
# Quick fix for DuckDB error - Skip loading examples
# For Linux servers
#

set -e

echo "=========================================="
echo "Fixing DuckDB Error - Skipping Examples"
echo "=========================================="
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
docker-compose -f docker-compose.custom.yml down
docker-compose -f docker-compose.custom.yml up -d

echo ""
echo "=========================================="
echo "Fix Applied!"
echo "=========================================="
echo ""
echo "Services are restarting. Check logs with:"
echo "  docker-compose -f docker-compose.custom.yml logs -f superset-init"
echo ""
echo "Once initialization completes, access Superset at:"
echo "  http://localhost:8088"
echo ""
echo "To monitor initialization progress:"
echo "  docker-compose -f docker-compose.custom.yml logs -f superset-init | grep -E 'Step|Complete|Error'"
echo ""

