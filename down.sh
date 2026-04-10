#!/usr/bin/env bash
set -o errexit -o pipefail -o noclobber

set -a # automatically export all variables
source docker/.env-local
set +a # stop automatically exporting

HOST_NAME=$(hostname -s)

echo "Stopping Superset on $HOST_NAME"

docker compose -f docker-compose-down.yml down --remove-orphans
