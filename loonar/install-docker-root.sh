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
  sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
else
  echo "[Step 6] Docker command found. Skipping installation."
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
