#!/bin/bash
# Startup script for Superset in Codespaces

echo "🚀 Starting Superset in Codespaces..."
echo "🌐 Frontend will be available at port 9001"

# Check if MCP is enabled
if [ "$ENABLE_MCP" = "true" ]; then
    echo "🤖 MCP Service will be available at port 5008"
fi

# Find the workspace directory (Codespaces clones as 'superset', not 'superset-2')
WORKSPACE_DIR=$(find /workspaces -maxdepth 1 -name "superset*" -type d | head -1)
if [ -n "$WORKSPACE_DIR" ]; then
    cd "$WORKSPACE_DIR"
    echo "📁 Working in: $WORKSPACE_DIR"
else
    echo "📁 Using current directory: $(pwd)"
fi

# Wait for Docker to become ready (Codespaces can resume before the daemon is up)
MAX_DOCKER_RETRIES=12
DOCKER_RETRY_INTERVAL=5
for attempt in $(seq 1 "$MAX_DOCKER_RETRIES"); do
    if docker info > /dev/null 2>&1; then
        break
    fi
    if [[ "$attempt" -eq "$MAX_DOCKER_RETRIES" ]]; then
        echo "❌ Docker did not become ready after $((MAX_DOCKER_RETRIES * DOCKER_RETRY_INTERVAL)) seconds"
        exit 1
    fi
    echo "⏳ Waiting for Docker to start (attempt ${attempt}/${MAX_DOCKER_RETRIES})..."
    sleep "$DOCKER_RETRY_INTERVAL"
done

# Clean up any existing containers
echo "🧹 Cleaning up existing containers..."
docker-compose -f docker-compose-light.yml --profile mcp down

# Start services
echo "🏗️  Building and starting services..."
echo ""
echo "📝 Once started, login with:"
echo "   Username: admin"
echo "   Password: admin"
echo ""
echo "📋 Running in foreground with live logs (Ctrl+C to stop)..."

# Run docker-compose and capture exit code
if [ "$ENABLE_MCP" = "true" ]; then
    echo "🤖 Starting with MCP Service enabled..."
    docker-compose -f docker-compose-light.yml --profile mcp up
else
    docker-compose -f docker-compose-light.yml up
fi
EXIT_CODE=$?

# If it failed, provide helpful instructions
if [ $EXIT_CODE -ne 0 ] && [ $EXIT_CODE -ne 130 ]; then  # 130 is Ctrl+C
    echo ""
    echo "❌ Superset startup failed (exit code: $EXIT_CODE)"
    echo ""
    echo "🔄 To restart Superset, run:"
    echo "   .devcontainer/start-superset.sh"
    echo ""
    echo "🔧 For troubleshooting:"
    echo "   # View logs:"
    echo "   docker-compose -f docker-compose-light.yml logs"
    echo ""
    echo "   # Clean restart (removes volumes):"
    echo "   docker-compose -f docker-compose-light.yml down -v"
    echo "   .devcontainer/start-superset.sh"
    echo ""
    echo "   # Common issues:"
    echo "   - Network timeouts: Just retry, often transient"
    echo "   - Port conflicts: Check 'docker ps'"
    echo "   - Database issues: Try clean restart with -v"
fi
