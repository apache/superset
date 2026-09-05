#!/usr/bin/env bash
#
# Licensed to the Apache Software Foundation (ASF) under one or more
# contributor license agreements.  See the NOTICE file distributed with
# this work for additional information regarding copyright ownership.
# The ASF licenses this file to You under the Apache License, Version 2.0
# (the "License"); you may not use this file except in compliance with
# the License.  You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#

set -eo pipefail

# Reinstalling superset-core/the app (and its postgres extra) on every container
# start is slow and, in DEV_MODE, mostly unnecessary: the source tree is bind-mounted
# in, so the only thing that actually changes between restarts of the same container
# is the dependency set. Hash the inputs that drive that dependency set and skip the
# install commands below when nothing relevant has changed since the last start.
SUPERSET_DEPS_HASH_FILE="/app/.venv/.superset-deps-hash"
SUPERSET_DEPS_POSTGRES_HASH_FILE="/app/.venv/.superset-deps-postgres-hash"

compute_superset_deps_hash() {
    {
        cat /app/pyproject.toml 2> /dev/null
        cat /app/requirements/*.txt 2> /dev/null
        if [ -f /app/superset-core/pyproject.toml ]; then
            cat /app/superset-core/pyproject.toml
        fi
    } | sha256sum | cut -d' ' -f1
}

CURRENT_SUPERSET_DEPS_HASH="$(compute_superset_deps_hash)"

# Make python interactive
if [ "$DEV_MODE" == "true" ]; then
    if [ "$(whoami)" = "root" ] && command -v uv > /dev/null 2>&1; then
      if [ ! -f "$SUPERSET_DEPS_HASH_FILE" ] || [ "$(cat "$SUPERSET_DEPS_HASH_FILE")" != "$CURRENT_SUPERSET_DEPS_HASH" ]; then
        # Always ensure superset-core is available
        echo "Installing superset-core in editable mode"
        uv pip install --no-deps -e /app/superset-core

        # Only reinstall the main app for non-worker processes
        if [ "$1" != "worker" ] && [ "$1" != "beat" ]; then
          echo "Reinstalling the app in editable mode"
          uv pip install -e .
        fi

        echo "$CURRENT_SUPERSET_DEPS_HASH" > "$SUPERSET_DEPS_HASH_FILE"
      else
        echo "Dependencies unchanged since last start, skipping superset-core/app reinstall"
      fi
    fi
fi
REQUIREMENTS_LOCAL="/app/docker/requirements-local.txt"
PORT=${PORT:-8088}
# If Cypress run – overwrite the password for admin and export env variables
if [ "$CYPRESS_CONFIG" == "true" ]; then
    export SUPERSET_TESTENV=true
    export POSTGRES_DB=superset_cypress
    export SUPERSET__SQLALCHEMY_DATABASE_URI=postgresql+psycopg2://superset:superset@db:5432/superset_cypress
    PORT=8081
fi
# Skip postgres requirements installation for workers to avoid conflicts
if [[ "$DATABASE_DIALECT" == postgres* ]] && [ "$(whoami)" = "root" ] && [ "$1" != "worker" ] && [ "$1" != "beat" ]; then
    if [ ! -f "$SUPERSET_DEPS_POSTGRES_HASH_FILE" ] || [ "$(cat "$SUPERSET_DEPS_POSTGRES_HASH_FILE")" != "$CURRENT_SUPERSET_DEPS_HASH" ]; then
        # older images may not have the postgres dev requirements installed
        echo "Installing postgres requirements"
        if command -v uv > /dev/null 2>&1; then
            # Use uv in newer images
            uv pip install -e .[postgres]
        else
            # Use pip in older images
            pip install -e .[postgres]
        fi
        echo "$CURRENT_SUPERSET_DEPS_HASH" > "$SUPERSET_DEPS_POSTGRES_HASH_FILE"
    else
        echo "Postgres requirements unchanged since last start, skipping reinstall"
    fi
fi
#
# Make sure we have dev requirements installed
#
if [ -f "${REQUIREMENTS_LOCAL}" ]; then
  echo "Installing local overrides at ${REQUIREMENTS_LOCAL}"
  if command -v uv > /dev/null 2>&1; then
    uv pip install --no-cache-dir -r "${REQUIREMENTS_LOCAL}"
  else
    pip install --no-cache-dir -r "${REQUIREMENTS_LOCAL}"
  fi
else
  echo "Skipping local overrides"
fi

case "${1}" in
  worker)
    echo "Starting Celery worker..."
    # setting up only 2 workers by default to contain memory usage in dev environments
    celery --app=superset.tasks.celery_app:app worker -O fair -l INFO --concurrency=${CELERYD_CONCURRENCY:-2} ${WORKER_LOG_FILE:+--logfile=$WORKER_LOG_FILE}
    ;;
  beat)
    echo "Starting Celery beat..."
    rm -f /tmp/celerybeat.pid
    celery --app=superset.tasks.celery_app:app beat --pidfile /tmp/celerybeat.pid -l INFO -s "${SUPERSET_HOME}"/celerybeat-schedule ${BEAT_LOG_FILE:+--logfile=$BEAT_LOG_FILE}
    ;;
  app)
    echo "Starting web app (using development server)..."

    # Default to Flask debug mode in this dev compose entrypoint so the Talisman
    # dev CSP (which permits 'unsafe-eval' required by React Refresh / HMR) is
    # served. Operators can still set FLASK_DEBUG=false in docker/.env-local
    # to exercise the production-like CSP and error handling.
    : "${FLASK_DEBUG:=1}"
    export FLASK_DEBUG

    # Werkzeug's interactive debugger (/console) is a separate, security-sensitive
    # feature and must be opted into explicitly via SUPERSET_DEBUG_ENABLED=true.
    if [[ "${SUPERSET_DEBUG_ENABLED:-}" == "true" ]]; then
        DEBUGGER_FLAG="--debugger"
        echo "  ⚠️  Werkzeug debugger enabled (requires PIN for /console access)"
    else
        DEBUGGER_FLAG="--no-debugger"
        echo "  🔒 Werkzeug debugger disabled (set SUPERSET_DEBUG_ENABLED=true to enable)"
    fi

    flask run -p $PORT --reload $DEBUGGER_FLAG --host=0.0.0.0 \
      --extra-files "/app/superset/extensions/.reload_trigger" \
      --exclude-patterns "*/node_modules/*:*/.venv/*:*/build/*:*/__pycache__/*:*/superset-frontend/*:*/superset/__init__.py"
    ;;
  app-gunicorn)
    echo "Starting web app..."
    /usr/bin/run-server.sh
    ;;
  mcp)
    echo "Starting MCP service..."
    superset mcp run --host 0.0.0.0 --port ${MCP_PORT:-5008} --debug
    ;;
  *)
    echo "Unknown Operation!!!"
    ;;
esac
