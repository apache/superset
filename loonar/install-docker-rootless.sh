#!/bin/bash

# This script sets up Docker in rootless mode for improved security.
# Rootless Docker allows a non-root user to run containers without requiring elevated privileges,
# reducing the risk of system compromise in case of container breakout.

# Name of the new user to be created for rootless Docker
USERNAME="dockeruser"
DOCKER_INSTALL_URL="https://get.docker.com/rootless"

# 👤 Create a new user for running Docker in rootless mode
echo "👤 Creating user $USERNAME..."
useradd -m -s /bin/bash "$USERNAME"

# 📦 Install required packages for user namespaces and DBus session management
echo "📦 Installing dependencies..."
apt update && apt install -y uidmap dbus-user-session curl

# 🐳 Install Docker rootless under the new user's environment
echo "🐳 Installing rootless Docker for $USERNAME..."
sudo -u "$USERNAME" bash -c "curl -fsSL $DOCKER_INSTALL_URL | sh"

# 📝 Add required environment variables to the user's .bashrc
echo "📝 Setting up environment variables..."
DOCKER_ENV_VARS=$(cat <<EOF

# Docker Rootless configuration
export PATH=\$HOME/bin:\$PATH
export DOCKER_HOST=unix:///run/user/\$(id -u)/docker.sock
EOF
)

echo "$DOCKER_ENV_VARS" >> /home/"$USERNAME"/.bashrc
chown "$USERNAME":"$USERNAME" /home/"$USERNAME"/.bashrc

# ✅ Final instructions
echo "✅ Rootless Docker has been configured for user $USERNAME."
echo "ℹ️ Switch to the user with: su - $USERNAME"
echo "🔁 Start the Docker daemon with: systemctl --user start docker"
