#!/usr/bin/env bash
# Script para desinstalar completamente o Docker (root e rootless)
# ATENÇÃO: Este script irá remover TODOS os dados, imagens, containers, volumes e configurações do Docker!
# Execute como root!

set -e

# Função para exibir mensagem de confirmação
confirm() {
    read -r -p "Tem certeza que deseja remover COMPLETAMENTE o Docker e todos os seus dados? [s/N] " response
    case "$response" in
        [sS][iI][mM]|[sS])
            ;;
        *)
            echo "Operação cancelada."
            exit 1
            ;;
    esac
}

confirm

echo "Parando serviços Docker (root e rootless)..."
systemctl stop docker.service docker.socket 2>/dev/null || true
systemctl stop docker 2>/dev/null || true
systemctl stop docker-rootless.socket docker-rootless@* 2>/dev/null || true
systemctl disable docker.service docker.socket 2>/dev/null || true
systemctl disable docker-rootless.socket docker-rootless@* 2>/dev/null || true

# Parar dockerd rootless manualmente, se rodando
if pgrep -u "$SUDO_USER" dockerd-rootless.sh >/dev/null 2>&1; then
    pkill -u "$SUDO_USER" dockerd-rootless.sh || true
fi

# Remover containers, imagens, volumes e redes
if command -v docker >/dev/null 2>&1; then
    echo "Removendo containers, imagens, volumes e redes Docker..."
    docker ps -aq | xargs -r docker rm -f
    docker images -aq | xargs -r docker rmi -f
    docker volume ls -q | xargs -r docker volume rm -f
    docker network ls -q | grep -v '^bridge$' | grep -v '^host$' | grep -v '^none$' | xargs -r docker network rm || true
fi

# Remover pacotes Docker (apenas para Ubuntu/Debian)
echo "Removendo pacotes Docker (apt)..."
apt-get purge -y docker-ce docker-ce-cli containerd.io docker-compose-plugin docker-ce-rootless-extras docker-scan-plugin || true
apt-get autoremove -y --purge || true

# Remover arquivos e diretórios Docker (root)
echo "Removendo arquivos e diretórios Docker (root)..."
rm -rf /var/lib/docker /var/lib/containerd /var/lib/docker-engine /var/run/docker /etc/docker /etc/systemd/system/docker.service.d /usr/bin/docker* /usr/local/bin/docker* /usr/libexec/docker /usr/share/docker /usr/share/doc/docker* /usr/share/man/man1/docker* /var/run/docker.sock

# Remover arquivos e diretórios Docker (usuário rootless)
if [ -n "$SUDO_USER" ] && [ "$SUDO_USER" != "root" ]; then
    echo "Removendo arquivos Docker do usuário $SUDO_USER (rootless)..."
    USER_HOME=$(eval echo ~$SUDO_USER)
    rm -rf "$USER_HOME/.docker" "$USER_HOME/.local/share/docker" "$USER_HOME/.config/docker" "$USER_HOME/.local/bin/docker" "$USER_HOME/bin/docker" "$USER_HOME/.docker/run" "$USER_HOME/.docker/cli-plugins" "$USER_HOME/.docker/contexts" "$USER_HOME/.docker/desktop" "$USER_HOME/.docker/scan" "$USER_HOME/.docker/cli-plugins" "$USER_HOME/.docker/cli-plugins/docker-compose" "$USER_HOME/.docker/cli-plugins/docker-buildx"
fi

# Remover grupo docker
if getent group docker >/dev/null 2>&1; then
    groupdel docker || true
fi

# Remover variáveis de ambiente relacionadas ao Docker
sed -i '/DOCKER_/d' /etc/environment 2>/dev/null || true

# Remover links simbólicos
find /usr/local/bin -type l -name 'docker*' -delete 2>/dev/null || true
find /usr/bin -type l -name 'docker*' -delete 2>/dev/null || true

# Limpeza final
updatedb 2>/dev/null || true

echo "Docker removido completamente do sistema."
