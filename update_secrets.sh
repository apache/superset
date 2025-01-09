#!/bin/bash
export INFISICAL_TOKEN=$(infisical login --method=universal-auth --client-id="${INFISICAL_CLIENT_ID}" --client-secret="${INFISICAL_CLIENT_SECRET}" --silent --plain)
export INFISICAL_VARIABLES=$(infisical export --format=dotenv --projectId="${INFISICAL_PROJECT_ID}" --env=prod --path="${ORIGIN_INFISICAL_PATH}")
export SUPERSET_SECRET_KEY=$(echo "${INFISICAL_VARIABLES}" | awk -F"SUPERSET_SECRET_KEY='" '{print $2}' | awk -F"'" '{if ($1 != "") print $1}')
export ESCAPED_SUPERSET_SECRET_KEY=$(printf '%s\n' "$SUPERSET_SECRET_KEY" | sed 's/[\/&]/\\&/g')
sed -i "s/^SUPERSET_SECRET_KEY=.*/SUPERSET_SECRET_KEY='${ESCAPED_SUPERSET_SECRET_KEY}'/" "${DESTINY_DIRECTORY_PATH}/superset/docker/.env"
sed -i "s/^SUPERSET_JWT_SECRET_KEY=.*/SUPERSET_JWT_SECRET_KEY='${ESCAPED_SUPERSET_SECRET_KEY}'/" ${DESTINY_DIRECTORY_PATH}/product-portal-be/.env
