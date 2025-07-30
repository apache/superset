#!/bin/bash
# Startup script for Superset in Codespaces

# Log to a file for debugging
LOG_FILE="/tmp/superset-startup.log"
echo "[$(date)] Starting Superset startup script" >> "$LOG_FILE"
echo "[$(date)] User: $(whoami), PWD: $(pwd)" >> "$LOG_FILE"

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
echo "[$(date)] Waiting for Docker..." >> "$LOG_FILE"
max_attempts=30
attempt=0
while ! docker info > /dev/null 2>&1; do
    if [ $attempt -eq $max_attempts ]; then
        echo "❌ Docker failed to start after $max_attempts attempts"
        echo "[$(date)] Docker failed to start after $max_attempts attempts" >> "$LOG_FILE"
        echo "🔄 Please restart the Codespace or run this script manually later"
        exit 1
    fi
    echo "   Attempt $((attempt + 1))/$max_attempts..."
    echo "[$(date)] Docker check attempt $((attempt + 1))/$max_attempts" >> "$LOG_FILE"
    sleep 2
    attempt=$((attempt + 1))
done
echo "✅ Docker is ready!"
echo "[$(date)] Docker is ready" >> "$LOG_FILE"

# Check if Superset containers are already running
if docker ps | grep -q "superset"; then
    echo "✅ Superset containers are already running!"
    echo ""
    echo "🌐 To access Superset:"
    echo "   1. Click the 'Ports' tab at the bottom of VS Code"
    echo "   2. Find port 9001 and click the globe icon to open"
    echo "   3. Wait 10-20 minutes for initial startup"
    echo ""
    echo "📝 Login credentials: admin/admin"
    exit 0
fi

# Clean up any existing containers
echo "🧹 Cleaning up existing containers..."
docker-compose -f docker-compose-light.yml down

# Start services
echo "🏗️  Starting Superset in background (daemon mode)..."
echo ""

# Start in detached mode
docker-compose -f docker-compose-light.yml up -d

echo ""
echo "✅ Docker Compose started successfully!"
echo ""
echo "📋 Important information:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⏱️  Initial startup takes 10-20 minutes"
echo "🌐 Check the 'Ports' tab for your Superset URL (port 9001)"
echo "👤 Login: admin / admin"
echo ""
echo "📊 Useful commands:"
echo "   docker-compose -f docker-compose-light.yml logs -f    # Follow logs"
echo "   docker-compose -f docker-compose-light.yml ps         # Check status"
echo "   docker-compose -f docker-compose-light.yml down       # Stop services"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "💤 Keeping terminal open for 60 seconds to test persistence..."
sleep 60
echo "✅ Test complete - check if this terminal is still visible!"

# Show final status
docker-compose -f docker-compose-light.yml ps
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
