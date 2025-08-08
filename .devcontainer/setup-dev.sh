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

# Add bashrc additions for automatic venv activation
echo "🔧 Setting up automatic environment activation..."
if [ -f ~/.bashrc ]; then
    # Check if we've already added our additions
    if ! grep -q "Superset Codespaces environment setup" ~/.bashrc; then
        echo "" >> ~/.bashrc
        cat .devcontainer/bashrc-additions >> ~/.bashrc
        echo "✅ Added automatic venv activation to ~/.bashrc"
    else
        echo "✅ Bashrc additions already present"
    fi
else
    # Create bashrc if it doesn't exist
    cat .devcontainer/bashrc-additions > ~/.bashrc
    echo "✅ Created ~/.bashrc with automatic venv activation"
fi

# Also add to zshrc since that's the default shell
if [ -f ~/.zshrc ] || [ -n "$ZSH_VERSION" ]; then
    if ! grep -q "Superset Codespaces environment setup" ~/.zshrc; then
        echo "" >> ~/.zshrc
        cat .devcontainer/bashrc-additions >> ~/.zshrc
        echo "✅ Added automatic venv activation to ~/.zshrc"
    fi
fi

echo "✅ Development environment setup complete!"
echo ""
echo "📝 The virtual environment will be automatically activated in new terminals"
echo ""
echo "🔄 To activate in this terminal, run:"
echo "   source ~/.bashrc"
echo ""
echo "🚀 To start Superset:"
echo "   start-superset"
echo ""
