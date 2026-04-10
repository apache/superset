#!/usr/bin/env bash
set -o errexit -o pipefail -o noclobber

set -a # automatically export all variables
source docker/.env-local
set +a # stop automatically exporting

HOST_NAME=$(hostname -s)

echo "Starting Superset at tag $TAG on $HOST_NAME"


docker compose -f docker-compose-camino.yml up --remove-orphans --build --detach

