#!/bin/bash
# Setup script for Superset Codespaces development environment

echo "🔧 Setting up Superset development environment..."

# System dependencies and uv are now pre-installed in the Docker image
# This speeds up Codespace creation significantly!

# Create virtual environment using uv
echo "🐍 Creating Python virtual environment..."
if ! uv venv; then
    echo "❌ Failed to create virtual environment"
    exit 1
fi

# Install Python dependencies
echo "📦 Installing Python dependencies..."
if ! uv pip install -r requirements/development.txt; then
    echo "❌ Failed to install Python dependencies"
    echo "💡 You may need to run this manually after the Codespace starts"
    exit 1
fi

# Install pre-commit hooks
echo "🪝 Installing pre-commit hooks..."
if source .venv/bin/activate && pre-commit install; then
    echo "✅ Pre-commit hooks installed"
else
    echo "⚠️  Pre-commit hooks installation failed (non-critical)"
fi

# Install Claude Code CLI via npm
echo "🤖 Installing Claude Code..."
if npm install -g @anthropic-ai/claude-code; then
    echo "✅ Claude Code installed"
else
    echo "⚠️  Claude Code installation failed (non-critical)"
fi

# Make the start script executable
chmod +x .devcontainer/start-superset.sh

echo "✅ Development environment setup complete!"
echo ""
echo "📝 Next steps:"
echo "1. Activate the Python virtual environment:"
echo "   source .venv/bin/activate"
echo ""
echo "2. Start Superset when Docker is ready:"
echo "   .devcontainer/start-superset.sh"
echo ""
echo "Note: The virtual environment is now created but not auto-activated to avoid startup issues."
