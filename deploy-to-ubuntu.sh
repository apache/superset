#!/bin/bash
#
# Quick deployment script for Ubuntu server
# Usage: ./deploy-to-ubuntu.sh [path-to-tar-file]
#

set -e

TAR_FILE=${1:-superset-custom-latest.tar}

echo "=========================================="
echo "Superset Custom - Ubuntu Deployment Script"
echo "=========================================="
echo ""

# Check if tar file exists
if [ ! -f "$TAR_FILE" ]; then
    echo "Error: Tar file not found: $TAR_FILE"
    echo "Usage: ./deploy-to-ubuntu.sh [path-to-tar-file]"
    exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "Error: Docker is not installed"
    echo "Install with: sudo apt install docker.io"
    exit 1
fi

# Check if docker compose is available
if ! docker compose version &> /dev/null && ! command -v docker-compose &> /dev/null; then
    echo "Error: Docker Compose is not installed"
    echo "Install with: sudo apt install docker-compose"
    exit 1
fi

echo "Step 1: Loading Docker image..."
docker load -i "$TAR_FILE"

echo ""
echo "Step 2: Creating deployment directory..."
mkdir -p ~/superset-production
cd ~/superset-production

# Check if docker-compose.yml already exists
if [ -f "docker-compose.yml" ]; then
    echo "Warning: docker-compose.yml already exists"
    read -p "Overwrite? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm docker-compose.yml
    else
        echo "Keeping existing docker-compose.yml"
        SKIP_COMPOSE=true
    fi
fi

if [ "$SKIP_COMPOSE" != "true" ]; then
    echo ""
    echo "Step 3: Creating docker-compose.yml..."
    cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  db:
    image: postgres:15
    container_name: superset_db
    environment:
      POSTGRES_USER: superset
      POSTGRES_PASSWORD: superset
      POSTGRES_DB: superset
    volumes:
      - superset_db_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U superset"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: superset_redis
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  superset:
    image: superset-custom:latest
    container_name: superset_app
    ports:
      - "8088:8088"
    environment:
      SUPERSET_CONFIG_PATH: /app/superset/superset_config.py
      SUPERSET_SECRET_KEY: ${SUPERSET_SECRET_KEY:-change-this-to-random-string}
      DATABASE_URL: postgresql://superset:superset@db:5432/superset
      REDIS_URL: redis://redis:6379/0
      SUPERSET_LOAD_EXAMPLES: "false"
    volumes:
      - superset_home:/app/superset_home
      - superset_data:/app/data
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped

volumes:
  superset_db_data:
  superset_home:
  superset_data:
EOF
    echo "Created docker-compose.yml"
fi

echo ""
echo "Step 4: Generating secret key..."
SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))" 2>/dev/null || openssl rand -base64 32)
echo "Generated secret key: $SECRET_KEY"
echo ""
read -p "Use this secret key? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    export SUPERSET_SECRET_KEY="$SECRET_KEY"
else
    read -p "Enter your secret key: " SUPERSET_SECRET_KEY
    export SUPERSET_SECRET_KEY
fi

echo ""
echo "Step 5: Starting database and redis..."
docker compose up -d db redis

echo ""
echo "Waiting for database to be ready..."
sleep 15

echo ""
echo "Step 6: Initializing Superset database..."
docker compose run --rm -e SUPERSET_SECRET_KEY="$SUPERSET_SECRET_KEY" superset superset db upgrade

echo ""
read -p "Create admin user? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -p "Admin username [admin]: " ADMIN_USER
    ADMIN_USER=${ADMIN_USER:-admin}
    read -p "Admin email [admin@example.com]: " ADMIN_EMAIL
    ADMIN_EMAIL=${ADMIN_EMAIL:-admin@example.com}
    read -sp "Admin password [admin]: " ADMIN_PASS
    ADMIN_PASS=${ADMIN_PASS:-admin}
    echo
    
    docker compose run --rm -e SUPERSET_SECRET_KEY="$SUPERSET_SECRET_KEY" superset \
      superset fab create-admin \
      --username "$ADMIN_USER" \
      --firstname Admin \
      --lastname User \
      --email "$ADMIN_EMAIL" \
      --password "$ADMIN_PASS"
fi

echo ""
echo "Step 7: Initializing Superset..."
docker compose run --rm -e SUPERSET_SECRET_KEY="$SUPERSET_SECRET_KEY" superset superset init

echo ""
echo "Step 8: Starting all services..."
docker compose up -d

echo ""
echo "=========================================="
echo "Deployment completed!"
echo "=========================================="
echo ""
echo "Superset is starting..."
echo "Wait 30-60 seconds, then access:"
echo "  http://$(hostname -I | awk '{print $1}'):8088"
echo ""
echo "Or if you know your server IP:"
echo "  http://YOUR_SERVER_IP:8088"
echo ""
echo "To view logs:"
echo "  cd ~/superset-production"
echo "  docker compose logs -f superset"
echo ""
echo "To stop:"
echo "  docker compose down"
echo ""
echo "To restart:"
echo "  docker compose restart"
echo ""

