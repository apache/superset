#!/bin/bash

# Ensure Docker daemon is running before running compose
if ! pgrep -x dockerd > /dev/null 2>&1; then
  echo "[ERROR] Docker daemon is not running. Please start Docker with: sudo systemctl start docker"
  exit 1
fi

# The --build argument ensures all the layers are up-to-date
if command -v docker-compose > /dev/null 2>&1; then
  docker-compose build --no-cache
  
  
  docker compose up --build
else
  echo "Error: 'docker compose' is not available. Please install Docker Compose v2."
  exit 1
fi
