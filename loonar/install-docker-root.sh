#!/usr/bin/env bash
set -e

# Versões
DOCKER_VERSION="25.0.5"
COMPOSE_VERSION="2.27.1"
BUILDX_VERSION="0.14.0"

echo "[1/9] Removendo instalações anteriores..."
sudo systemctl stop docker || true
sudo apt remove --purge -y docker docker.io docker-doc docker-compose docker-compose-plugin containerd runc || true
sudo rm -rf /usr/local/bin/docker* /etc/systemd/system/docker.service
sudo rm -rf /etc/docker /var/lib/docker /var/run/docker.sock
sudo apt autoremove -y

echo "[2/9] Instalando dependências do sistema..."
sudo apt update
sudo apt install -y ca-certificates curl gnupg lsb-release iptables pigz containerd

echo "[3/9] Instalando Docker binário (dockerd + docker)..."
curl -fsSL "https://download.docker.com/linux/static/stable/x86_64/docker-${DOCKER_VERSION}.tgz" -o docker.tgz
sudo tar xzvf docker.tgz --strip-components=1 -C /usr/local/bin docker/docker docker/dockerd
rm docker.tgz

echo "[4/9] Instalando Docker Compose v2..."
sudo curl -L "https://github.com/docker/compose/releases/download/v${COMPOSE_VERSION}/docker-compose-linux-x86_64" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

echo "[5/9] Instalando Buildx..."
mkdir -p ~/.docker/cli-plugins
curl -L "https://github.com/docker/buildx/releases/download/v${BUILDX_VERSION}/buildx-v${BUILDX_VERSION}.linux-amd64" -o ~/.docker/cli-plugins/docker-buildx
chmod +x ~/.docker/cli-plugins/docker-buildx

echo "[6/9] Criando systemd service para o Docker..."
sudo tee /etc/systemd/system/docker.service > /dev/null <<EOF
[Unit]
Description=Docker Application Container Engine
Documentation=https://docs.docker.com
After=network.target

[Service]
Type=notify
ExecStart=/usr/local/bin/dockerd
ExecReload=/bin/kill -s HUP \$MAINPID
TimeoutSec=0
RestartSec=2
Restart=always
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

echo "[7/9] Habilitando BuildKit e preparando diretórios..."
sudo mkdir -p /etc/docker
echo '{"features": {"buildkit": true}}' | sudo tee /etc/docker/daemon.json

sudo groupadd -f docker
sudo usermod -aG docker "$USER"

echo "[8/9] Ativando e iniciando Docker..."
sudo systemctl daemon-reload
sudo systemctl enable docker
sudo systemctl restart docker

echo "[9/9] Verificações finais..."
docker --version
docker compose version
docker buildx version
echo -e "\n✅ Docker, Buildx e Compose instalados com sucesso no Ubuntu 24.04!"
echo "ℹ️ Faça logout/login ou execute: newgrp docker"
