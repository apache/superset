#!/bin/bash
set -e

# This script reads client config and deploys Superset with proper DB credentials

if [ -z "$1" ]; then
  echo "Usage: $0 <path-to-client-config.json>"
  exit 1
fi

CONFIG_PATH="$1"

echo "Reading database credentials from client config..."

# Extract postgres credentials (similar to how postgres deployment does it)
DB_CONFIG=$(powershell -File "$(dirname "$0")/Get-SupersetDBCreds.ps1" -ConfigPath "$CONFIG_PATH")

# Export as environment variables
export $(echo "$DB_CONFIG" | grep -v "^$" | xargs)

echo "Database configuration loaded:"
echo "  Superset metadata DB: ${SUPERSET_DB_USER}@${SUPERSET_DB_HOST}:${SUPERSET_DB_PORT}/${SUPERSET_DB_NAME}"
echo "  OEE data DB: ${OEE_DB_USER}@${OEE_DB_HOST}:${OEE_DB_PORT}/${OEE_DB_NAME}"

# Create superset_metadata database if it doesn't exist
echo "Creating superset_metadata database if needed..."
docker exec -i oee-postgres bash -c "export PGPASSWORD='${SUPERSET_DB_PASSWORD}' && psql -h 127.0.0.1 -U ${SUPERSET_DB_USER} -d postgres -c 'CREATE DATABASE ${SUPERSET_DB_NAME};' 2>/dev/null || echo 'Database already exists'"

# Deploy with docker-compose
echo "Deploying Superset stack..."
docker-compose -f docker-compose-deploy.yml up -d

echo "✓ Superset deployment complete!"
