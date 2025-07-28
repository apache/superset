#!/bin/bash
# Setup script for Superset Codespaces development environment

set -e

echo "🔧 Setting up Superset development environment..."

# Install additional system dependencies
echo "📦 Installing system dependencies..."
sudo apt-get update
sudo apt-get install -y \
    build-essential \
    libssl-dev \
    libffi-dev \
    libsasl2-dev \
    libldap2-dev \
    libpq-dev \
    python3-pip \
    python3-venv

# Make the start script executable
chmod +x .devcontainer/start-superset.sh

echo "✅ Development environment setup complete!"
echo "🚀 Run '.devcontainer/start-superset.sh' to start Superset"
