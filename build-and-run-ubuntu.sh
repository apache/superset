#!/bin/bash
#
# Complete automated build and run script for Ubuntu
# This script does everything: builds the image and runs Superset
# Usage: ./build-and-run-ubuntu.sh
#

set -e

echo "=========================================="
echo "Superset Custom - Automated Build & Run"
echo "=========================================="
echo ""

# Check if we're in the right directory
if [ ! -f "Dockerfile" ]; then
    echo "Error: Dockerfile not found. Please run this script from the Superset root directory."
    exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "Error: Docker is not installed"
    echo "Install with: sudo apt update && sudo apt install -y docker.io docker-compose"
    exit 1
fi

# Check if user is in docker group
if ! groups | grep -q docker; then
    echo "Warning: User not in docker group"
    echo "Adding user to docker group (requires sudo)..."
    sudo usermod -aG docker $USER
    echo "Please log out and log back in, then run this script again"
    exit 1
fi

# Check if docker compose is available
if ! docker compose version &> /dev/null && ! command -v docker-compose &> /dev/null; then
    echo "Error: Docker Compose is not installed"
    echo "Install with: sudo apt install -y docker-compose"
    exit 1
fi

IMAGE_TAG="superset-custom:latest"
COMPOSE_FILE="docker-compose.production.yml"

echo "Step 1: Building Docker image..."
echo "This will take 20-30 minutes. Please be patient..."
echo ""

docker build \
  --target lean \
  --tag "$IMAGE_TAG" \
  --build-arg BUILD_TRANSLATIONS=false \
  --build-arg DEV_MODE=false \
  --build-arg INCLUDE_CHROMIUM=false \
  --progress=plain \
  .

if [ $? -ne 0 ]; then
    echo ""
    echo "Error: Docker build failed!"
    exit 1
fi

echo ""
echo "Build completed successfully!"
echo ""

# Create docker-compose file if it doesn't exist
if [ ! -f "$COMPOSE_FILE" ]; then
    echo "Step 2: Creating docker-compose.production.yml..."
    
    # Generate secret key
    SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))" 2>/dev/null || openssl rand -base64 32)
    
    cat > "$COMPOSE_FILE" << EOF
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
    image: $IMAGE_TAG
    container_name: superset_app
    ports:
      - "8088:8088"
    environment:
      SUPERSET_SECRET_KEY: "$SECRET_KEY"
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
    
    echo "Created $COMPOSE_FILE with generated secret key"
    echo ""
fi

# Check if containers already exist
if docker ps -a | grep -q superset_app; then
    echo "Step 3: Stopping existing containers..."
    docker compose -f "$COMPOSE_FILE" down
    echo ""
fi

echo "Step 4: Starting database and redis..."
docker compose -f "$COMPOSE_FILE" up -d db redis

echo ""
echo "Waiting for database to be ready (15 seconds)..."
sleep 15

# Check if database needs initialization
if ! docker compose -f "$COMPOSE_FILE" exec -T db psql -U superset -d superset -c "SELECT 1;" &> /dev/null 2>&1; then
    echo ""
    echo "Step 5: Initializing Superset database..."
    docker compose -f "$COMPOSE_FILE" run --rm superset superset db upgrade
    
    echo ""
    echo "Step 6: Creating admin user..."
    ADMIN_USER="admin"
    ADMIN_EMAIL="admin@example.com"
    ADMIN_PASS="admin"
    
    docker compose -f "$COMPOSE_FILE" run --rm superset \
      superset fab create-admin \
      --username "$ADMIN_USER" \
      --firstname Admin \
      --lastname User \
      --email "$ADMIN_EMAIL" \
      --password "$ADMIN_PASS" || true
    
    echo ""
    echo "Step 7: Initializing Superset..."
    docker compose -f "$COMPOSE_FILE" run --rm superset superset init
else
    echo ""
    echo "Database already initialized, skipping setup steps..."
fi

echo ""
echo "Step 8: Starting all services..."
docker compose -f "$COMPOSE_FILE" up -d

echo ""
echo "=========================================="
echo "Setup completed successfully!"
echo "=========================================="
echo ""
echo "Superset is starting..."
echo "Wait 30-60 seconds for services to be ready"
echo ""
echo "Access Superset at:"
SERVER_IP=$(hostname -I | awk '{print $1}' 2>/dev/null || echo "localhost")
echo "  http://$SERVER_IP:8088"
echo ""
echo "Default login credentials:"
echo "  Username: admin"
echo "  Password: admin"
echo ""
echo "Useful commands:"
echo "  View logs:        docker compose -f $COMPOSE_FILE logs -f"
echo "  Stop services:    docker compose -f $COMPOSE_FILE down"
echo "  Restart:          docker compose -f $COMPOSE_FILE restart"
echo "  Check status:     docker compose -f $COMPOSE_FILE ps"
echo ""

