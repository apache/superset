#!/bin/bash
# Setup script for Superset Codespaces development environment

set -e

echo "🔧 Setting up Superset development environment..."

# The universal image has most tools, just need Superset-specific libs
echo "📦 Installing Superset-specific dependencies..."
sudo apt-get update
sudo apt-get install -y \
    libsasl2-dev \
    libldap2-dev \
    libpq-dev

# Make the start script executable
chmod +x .devcontainer/start-superset.sh

echo "✅ Development environment setup complete!"
echo "🚀 Run '.devcontainer/start-superset.sh' to start Superset"
