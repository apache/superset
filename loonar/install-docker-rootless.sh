#!/bin/bash

# This script sets up Docker in rootless mode for improved security.
# Rootless Docker allows a non-root user to run containers without requiring elevated privileges,
# reducing the risk of system compromise in case of container breakout.

set -e

USERNAME="dockeruser"
DOCKER_INSTALL_URL="https://get.docker.com/rootless"

# Check if the user already exists
if id "$USERNAME" &>/dev/null; then
  echo "👤 User $USERNAME already exists. Skipping creation."
else
  echo "👤 Creating user $USERNAME..."
  useradd -m -s /bin/bash "$USERNAME"
fi

# Check if dependencies are already installed
REQUIRED_PKGS=(uidmap dbus-user-session curl)
MISSING_PKGS=()
for pkg in "${REQUIRED_PKGS[@]}"; do
  dpkg -s "$pkg" &>/dev/null || MISSING_PKGS+=("$pkg")
done
if [ ${#MISSING_PKGS[@]} -eq 0 ]; then
  echo "📦 Dependencies already installed."
else
  echo "📦 Installing dependencies: ${MISSING_PKGS[*]}..."
  apt update && apt install -y "${MISSING_PKGS[@]}"
fi

# Check if rootless Docker is already installed
if sudo -u "$USERNAME" test -x "/home/$USERNAME/bin/dockerd-rootless-setuptool.sh"; then
  echo "🐳 Rootless Docker already installed for $USERNAME."
else
  echo "🐳 Installing rootless Docker for $USERNAME..."
  sudo -u "$USERNAME" bash -c "curl -fsSL $DOCKER_INSTALL_URL | sh || true"
fi

# Check if rootlesskit failed due to AppArmor restriction
if grep -q "apparmor_restrict_unprivileged_userns" /home/$USERNAME/.docker/rootlesskit.log 2>/dev/null || \
   grep -q "permission denied" /home/$USERNAME/.docker/rootlesskit.log 2>/dev/null; then
  echo "⚠️ Detected AppArmor restriction. Applying AppArmor exception for rootlesskit..."

  APPARMOR_FILE="/etc/apparmor.d/home.$USERNAME.bin.rootlesskit"
  if [ -f "$APPARMOR_FILE" ]; then
    echo "🔒 AppArmor profile already exists. Skipping creation."
  else
    cat <<EOT | sudo tee "$APPARMOR_FILE"
# ref: https://ubuntu.com/blog/ubuntu-23-10-restricted-unprivileged-user-namespaces
abi <abi/4.0>,
include <tunables/global>

/home/$USERNAME/bin/rootlesskit flags=(unconfined) {
  userns,

  # Site-specific additions and overrides. See local/README for details.
  include if exists <local/home.$USERNAME.bin.rootlesskit>
}
EOT
  fi

  sudo systemctl restart apparmor.service
  echo "🔁 AppArmor profile applied and reloaded."
  echo "🔄 Re-running rootless Docker setup..."
  sudo -u "$USERNAME" bash -c "$HOME/bin/dockerd-rootless-setuptool.sh install"
fi

echo "📝 Setting up environment variables..."
DOCKER_ENV_VARS=$(cat <<EOF

# Docker Rootless configuration
export PATH=\$HOME/bin:\$PATH
export DOCKER_HOST=unix:///run/user/\$(id -u)/docker.sock
EOF
)

BASHRC="/home/$USERNAME/.bashrc"
if grep -q "DOCKER_HOST=unix:///run/user/\$(id -u)/docker.sock" "$BASHRC"; then
  echo "🔎 Docker environment variables already present in $BASHRC."
else
  echo "$DOCKER_ENV_VARS" >> "$BASHRC"
  chown "$USERNAME":"$USERNAME" "$BASHRC"
  echo "✅ Docker environment variables added to $BASHRC."
fi

echo "✅ Rootless Docker has been configured for user $USERNAME."
echo "ℹ️ Switch to the user with: su - $USERNAME"
echo "🔁 Start the Docker daemon with: systemctl --user start docker"
