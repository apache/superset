FROM gitpod/workspace-postgres

RUN sudo apt-get update && \
    sudo apt-get install -y redis-server && \
    sudo rm -rf sudo rm -rf /var/lib/apt/lists/*
