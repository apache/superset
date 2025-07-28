#!/bin/bash
# Startup script for Superset in Codespaces

set -e

echo "🚀 Starting Superset in Codespaces..."
echo "📦 Using project name: ${CODESPACE_NAME}"
echo "🌐 Frontend will be available at port 9001"

# Ensure we're in the right directory
cd /workspaces/superset-2 || cd /workspaces/superset || cd .

# Check if docker is running
if ! docker info > /dev/null 2>&1; then
    echo "⏳ Waiting for Docker to start..."
    sleep 5
fi

# Clean up any existing containers from this project
echo "🧹 Cleaning up existing containers..."
docker-compose -p "${CODESPACE_NAME}" -f docker-compose-light.yml down

# Start services
echo "🏗️  Building and starting services..."
docker-compose -p "${CODESPACE_NAME}" -f docker-compose-light.yml up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be ready..."
sleep 10

# Show status
echo "✅ Services started! Status:"
docker-compose -p "${CODESPACE_NAME}" -f docker-compose-light.yml ps

echo ""
echo "📝 Default credentials:"
echo "   Username: admin"
echo "   Password: admin"
echo ""
echo "🌐 Access Superset at the forwarded port 9001"
echo "💡 To view logs: docker-compose -p ${CODESPACE_NAME} -f docker-compose-light.yml logs -f"
