#!/usr/bin/env bash

set -e

# 1. Remove any old Docker installations
sudo apt remove --purge -y docker.io docker-doc docker-compose docker-compose-plugin docker-buildx-plugin containerd runc || true
sudo apt autoremove -y

# 2. Install dependencies
sudo apt update
sudo apt install -y ca-certificates curl gnupg lsb-release

# 3. Install Docker Engine (static binary)
DOCKER_VERSION="25.0.5"
echo "[Step 3] Downloading Docker Engine binaries..."
curl -fsSL "https://download.docker.com/linux/static/stable/x86_64/docker-${DOCKER_VERSION}.tgz" -o docker.tgz
sudo tar xzvf docker.tgz --strip-components=1 -C /usr/local/bin docker/docker docker/dockerd
rm docker.tgz

# 4. Install Docker Compose v2 (official binary)
COMPOSE_VERSION="2.27.1"
echo "[Step 4] Installing Docker Compose v2..."
sudo curl -L "https://github.com/docker/compose/releases/download/v${COMPOSE_VERSION}/docker-compose-linux-x86_64" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 5. Install Buildx (official binary)
BUILDX_VERSION="0.14.0"
echo "[Step 5] Installing Buildx..."
sudo mkdir -p ~/.docker/cli-plugins/
sudo curl -L "https://github.com/docker/buildx/releases/download/v${BUILDX_VERSION}/buildx-v${BUILDX_VERSION}.linux-amd64" -o ~/.docker/cli-plugins/docker-buildx
sudo chmod +x ~/.docker/cli-plugins/docker-buildx

# 6. Create systemd service for Docker
sudo tee /etc/systemd/system/docker.service > /dev/null <<EOF
[Unit]
Description=Docker Application Container Engine
Documentation=https://docs.docker.com
After=network-online.target firewalld.service
Wants=network-online.target

[Service]
Type=notify
ExecStart=/usr/local/bin/dockerd
ExecReload=/bin/kill -s HUP $MAINPID
TimeoutSec=0
RestartSec=2
Restart=always
StartLimitBurst=3
StartLimitInterval=60s
LimitNOFILE=infinity
LimitNPROC=infinity
LimitCORE=infinity
TasksMax=infinity
Delegate=yes
KillMode=process
OOMScoreAdjust=-500

[Install]
WantedBy=multi-user.target
EOF

# 7. Enable BuildKit in daemon.json
sudo mkdir -p /etc/docker
echo '{"features": {"buildkit": true}}' | sudo tee /etc/docker/daemon.json

# 8. Create docker group and add user
sudo groupadd -f docker
sudo usermod -aG docker "$USER"

# 9. Enable and start Docker
sudo systemctl daemon-reload
sudo systemctl enable docker
sudo systemctl restart docker

# 10. Test installation
docker --version
docker compose version
docker buildx version
echo "[OK] Docker, Compose e BuildKit instalados no Ubuntu 24.04!"


