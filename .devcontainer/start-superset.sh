#!/bin/bash
# Startup script for Superset in Codespaces

echo "🚀 Starting Superset in Codespaces..."
echo "🌐 Frontend will be available at port 9001"

# Find the workspace directory (Codespaces clones as 'superset', not 'superset-2')
WORKSPACE_DIR=$(find /workspaces -maxdepth 1 -name "superset*" -type d | head -1)
if [ -n "$WORKSPACE_DIR" ]; then
    cd "$WORKSPACE_DIR"
    echo "📁 Working in: $WORKSPACE_DIR"
else
    echo "📁 Using current directory: $(pwd)"
fi

# Wait for Docker to be available
echo "⏳ Waiting for Docker to start..."
max_attempts=30
attempt=0
while ! docker info > /dev/null 2>&1; do
    if [ $attempt -eq $max_attempts ]; then
        echo "❌ Docker failed to start after $max_attempts attempts"
        echo "🔄 Please restart the Codespace or run this script manually later"
        exit 1
    fi
    echo "   Attempt $((attempt + 1))/$max_attempts..."
    sleep 2
    attempt=$((attempt + 1))
done
echo "✅ Docker is ready!"

# Clean up any existing containers
echo "🧹 Cleaning up existing containers..."
docker-compose -f docker-compose-light.yml down

# Start services
echo "🏗️  Building and starting services..."
echo ""
echo "📝 Once started, login with:"
echo "   Username: admin"
echo "   Password: admin"
echo ""
echo "📋 Running in foreground with live logs (Ctrl+C to stop)..."

# Run docker-compose and capture exit code
docker-compose -f docker-compose-light.yml up
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
