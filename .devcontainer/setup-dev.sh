#!/bin/bash
# Setup script for Superset Codespaces development environment

echo "🔧 Setting up Superset development environment..."

# The universal image has most tools, just need Superset-specific libs
echo "📦 Installing Superset-specific dependencies..."
sudo apt-get update
sudo apt-get install -y \
    libsasl2-dev \
    libldap2-dev \
    libpq-dev \
    tmux \
    gh

# Install uv for fast Python package management
echo "📦 Installing uv..."
curl -LsSf https://astral.sh/uv/install.sh | sh

# Add cargo/bin to PATH for uv
echo 'export PATH="$HOME/.cargo/bin:$PATH"' >> ~/.bashrc
echo 'export PATH="$HOME/.cargo/bin:$PATH"' >> ~/.zshrc

# Source the PATH update for the current session
export PATH="$HOME/.cargo/bin:$PATH"

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
