#!/bin/bash
# Setup script for Superset Codespaces development environment

echo "🔧 Setting up Superset development environment..."

# System dependencies and uv are now pre-installed in the Docker image
# This speeds up Codespace creation significantly!

# Create virtual environment using uv
echo "🐍 Creating Python virtual environment..."
uv venv

# Install Python dependencies
echo "📦 Installing Python dependencies..."
uv pip install -r requirements/development.txt

# Install pre-commit hooks
echo "🪝 Installing pre-commit hooks..."
source .venv/bin/activate && pre-commit install

# Install Claude Code CLI via npm
echo "🤖 Installing Claude Code..."
npm install -g @anthropic-ai/claude-code

# Make the start script executable
chmod +x .devcontainer/start-superset.sh

echo "✅ Development environment setup complete!"
echo "🚀 Run '.devcontainer/start-superset.sh' to start Superset"
