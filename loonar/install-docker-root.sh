#!/usr/bin/env bash

# 1. Update the package list
echo "[Step 1] Updating the package list..."
sudo apt update

# 2. Install dependencies
echo "[Step 2] Installing dependencies..."
sudo apt install -y ca-certificates curl gnupg lsb-release

# 3. Add Docker's official GPG key
echo "[Step 3] Adding Docker's official GPG key..."
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# 4. Set up the stable Docker repository
echo "[Step 4] Setting up the stable Docker repository..."
echo \
  "deb [arch=$(dpkg --print-architecture) \
  signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 5. Update the repositories with the new source
echo "[Step 5] Updating repositories with the new Docker source..."
sudo apt update

# 6. Install Docker Engine, CLI, and containerd only if not already installed
if ! command -v docker > /dev/null 2>&1; then
  echo "[Step 6] Installing Docker Engine, CLI, and containerd..."
  os_version=$(lsb_release -cs)
  if [ "$os_version" = "noble" ]; then
    echo "[Step 6] Ubuntu 24.04 (noble) detected."
    echo "[WARNING] Official Docker CE packages are NOT available for Ubuntu 24.04 (noble) yet."
    echo "[WARNING] The script will install docker.io and related packages from Ubuntu's repository as a fallback."
    echo "[WARNING] BuildKit/buildx features may NOT work properly. For full support, use Ubuntu 22.04 (jammy) or wait for Docker to release official packages."
    # Remove containerd.io if present (from Docker repo)
    if dpkg -l | grep -q containerd.io; then
      echo "Removing conflicting containerd.io package..."
      sudo apt remove -y containerd.io
    fi
    # Ensure containerd from Ubuntu repo is installed
    sudo apt install -y containerd
    # Remove Docker repo from sources to avoid further conflicts
    sudo rm -f /etc/apt/sources.list.d/docker.list
    sudo apt update
    # Install docker.io and plugins from Ubuntu repo
    sudo apt install -y docker.io docker-buildx-plugin || true
    # Try to install docker-compose-plugin if available
    if apt-cache show docker-compose-plugin > /dev/null 2>&1; then
      sudo apt install -y docker-compose-plugin
    else
      echo "[WARNING] docker-compose-plugin not available. Installing standalone docker-compose as fallback."
      sudo apt install -y docker-compose
    fi
  else
    sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin docker-compose
  fi
else
  echo "[Step 6] Docker command found. Skipping installation."
fi

# 6.5. Enable Docker BuildKit by default
DOCKER_DAEMON_JSON="/etc/docker/daemon.json"
echo "[Step 6.5] Enabling Docker BuildKit in $DOCKER_DAEMON_JSON..."
sudo mkdir -p /etc/docker
if [ -f "$DOCKER_DAEMON_JSON" ]; then
  # Merge or update features.buildkit to true
  if grep -q '"features"' "$DOCKER_DAEMON_JSON"; then
    sudo jq '.features.buildkit = true | .features' "$DOCKER_DAEMON_JSON" | sudo tee "$DOCKER_DAEMON_JSON.tmp" > /dev/null && sudo mv "$DOCKER_DAEMON_JSON.tmp" "$DOCKER_DAEMON_JSON"
  else
    sudo jq '. + {features: {buildkit: true}}' "$DOCKER_DAEMON_JSON" | sudo tee "$DOCKER_DAEMON_JSON.tmp" > /dev/null && sudo mv "$DOCKER_DAEMON_JSON.tmp" "$DOCKER_DAEMON_JSON"
  fi
else
  echo '{"features": {"buildkit": true}}' | sudo tee "$DOCKER_DAEMON_JSON" > /dev/null
fi

# Restart Docker to apply BuildKit config
if systemctl list-unit-files | grep -q docker.service; then
  echo "[Step 6.5] Restarting Docker to apply BuildKit config..."
  sudo systemctl restart docker
fi

# 7. Ensure the 'docker' group exists and add your user to it to avoid using sudo
group_exists=$(getent group docker)
if [ -z "$group_exists" ]; then
  echo "[Step 7] Creating 'docker' group..."
  sudo groupadd docker
else
  echo "[Step 7] 'docker' group already exists."
fi
echo "[Step 7] Adding user '$USER' to 'docker' group..."
sudo usermod -aG docker "$USER"

# 8. Ensure Docker service is enabled and started
if systemctl list-unit-files | grep -q docker.service; then
  echo "[Step 8] Enabling and starting Docker service..."
  sudo systemctl enable docker
  sudo systemctl start docker
else
  echo "[Step 8] Docker service file not found. If using rootless or alternative install, start Docker manually."
fi


