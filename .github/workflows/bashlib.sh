#!/bin/bash
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
set -e

GITHUB_WORKSPACE=${GITHUB_WORKSPACE:-.}
ASSETS_MANIFEST="$GITHUB_WORKSPACE/superset/static/assets/manifest.json"

# Echo only when not in parallel mode
say() {
  if [[ $(echo "$INPUT_PARALLEL" | tr '[:lower:]' '[:upper:]') != 'TRUE' ]]; then
    echo "$1"
  fi
}

pip-upgrade() {
  say "::group::Upgrade pip"
  pip install --upgrade pip
  say "::endgroup::"
}

# prepare (lint and build) frontend code
npm-install() {
  cd "$GITHUB_WORKSPACE/superset-frontend"

  # cache-restore npm
  say "::group::Install npm packages"
  echo "npm: $(npm --version)"
  echo "node: $(node --version)"
  npm ci
  say "::endgroup::"

  # cache-save npm
}

build-assets() {
  cd "$GITHUB_WORKSPACE/superset-frontend"

  say "::group::Build static assets"
  npm run build
  say "::endgroup::"
}

build-embedded-sdk() {
  cd "$GITHUB_WORKSPACE/superset-embedded-sdk"

  say "::group::Build embedded SDK bundle for E2E tests"
  npm ci
  npm run build
  say "::endgroup::"
}

build-instrumented-assets() {
  cd "$GITHUB_WORKSPACE/superset-frontend"

  say "::group::Build static assets with JS instrumented for test coverage"
  cache-restore instrumented-assets
  if [[ -f "$ASSETS_MANIFEST" ]]; then
    echo 'Skip frontend build because instrumented static assets already exist.'
  else
    npm run build-instrumented
    cache-save instrumented-assets
  fi
  say "::endgroup::"
}

setup-postgres() {
  say "::group::Install dependency for unit tests"
  sudo apt-get update && sudo apt-get install --yes libecpg-dev
  say "::group::Initialize database"
  psql "postgresql://superset:superset@127.0.0.1:15432/superset" <<-EOF
    DROP SCHEMA IF EXISTS sqllab_test_db CASCADE;
    DROP SCHEMA IF EXISTS admin_database CASCADE;
    CREATE SCHEMA sqllab_test_db;
    CREATE SCHEMA admin_database;
EOF
  say "::endgroup::"
}

setup-mysql() {
  say "::group::Initialize database"
  mysql -h 127.0.0.1 -P 13306 -u root --password=root <<-EOF
    SET GLOBAL transaction_isolation='READ-COMMITTED';
    SET GLOBAL TRANSACTION ISOLATION LEVEL READ COMMITTED;
    DROP DATABASE IF EXISTS superset;
    CREATE DATABASE superset DEFAULT CHARACTER SET utf8 COLLATE utf8_unicode_ci;
    DROP DATABASE IF EXISTS sqllab_test_db;
    CREATE DATABASE sqllab_test_db DEFAULT CHARACTER SET utf8 COLLATE utf8_unicode_ci;
    DROP DATABASE IF EXISTS admin_database;
    CREATE DATABASE admin_database DEFAULT CHARACTER SET utf8 COLLATE utf8_unicode_ci;
    CREATE USER 'superset'@'%' IDENTIFIED BY 'superset';
    GRANT ALL ON *.* TO 'superset'@'%';
    FLUSH PRIVILEGES;
EOF
  say "::endgroup::"
}

testdata() {
  cd "$GITHUB_WORKSPACE"
  say "::group::Load test data"
  # must specify PYTHONPATH to make `tests.superset_test_config` importable
  export PYTHONPATH="$GITHUB_WORKSPACE"
  uv pip install --system -e .
  superset db upgrade
  superset load_test_users
  superset load_examples --load-test-data
  superset init
  say "::endgroup::"
}

playwright_testdata() {
  cd "$GITHUB_WORKSPACE"
  say "::group::Load all examples for Playwright tests"
  # must specify PYTHONPATH to make `tests.superset_test_config` importable
  export PYTHONPATH="$GITHUB_WORKSPACE"
  uv pip install --system -e .
  superset db upgrade
  superset load_test_users
  superset load_examples
  superset init
  # Enable DML on the examples database so Playwright tests can create/drop
  # temporary tables via SQL Lab without depending on external data sources.
  superset shell <<'PYEOF'
import sys
from superset.extensions import db
from superset.models.core import Database
examples_db = db.session.query(Database).filter_by(database_name='examples').first()
if not examples_db:
    sys.exit('ERROR: examples database not found. load_examples may have failed.')

examples_db.allow_dml = True
db.session.commit()
print('Enabled allow_dml on examples database')
PYEOF
  say "::endgroup::"
}

celery-worker() {
  cd "$GITHUB_WORKSPACE"
  say "::group::Start Celery worker"
  # must specify PYTHONPATH to make `tests.superset_test_config` importable
  export PYTHONPATH="$GITHUB_WORKSPACE"
  celery \
    --app=superset.tasks.celery_app:app \
    worker \
      --concurrency=2 \
      --detach \
      --optimization=fair
  say "::endgroup::"
}

cypress-install() {
  cd "$GITHUB_WORKSPACE/superset-frontend/cypress-base"

  cache-restore cypress

  say "::group::Install Cypress"
  npm ci
  say "::endgroup::"

  cache-save cypress
}

cypress-run-all() {
  local USE_DASHBOARD=$1
  local APP_ROOT=$2
  cd "$GITHUB_WORKSPACE/superset-frontend/cypress-base"

  # Start the Superset backend via gunicorn (not `flask run`). The Flask
  # development server is single-threaded and has no crash-recovery, so
  # heavy tests (dashboard import/export, SQL Lab) can knock it offline
  # for the rest of the run — surfacing as `ECONNREFUSED` / `socket hang up`
  # / `Missing CSRF token` cascades. Gunicorn gives us multiple workers,
  # a request timeout, and worker-recycling under load.
  local serverlog="${HOME}/superset-cypress.log"
  local port=8081
  CYPRESS_BASE_URL="http://localhost:${port}"
  if [ -n "$APP_ROOT" ]; then
    export SUPERSET_APP_ROOT=$APP_ROOT
    CYPRESS_BASE_URL=${CYPRESS_BASE_URL}${APP_ROOT}
  fi
  export CYPRESS_BASE_URL

  # Mirrors the args in docker/entrypoints/run-server.sh (1 worker × 20
  # gthread threads) to keep parity with production. Multi-worker
  # configurations expose timing-sensitive races in the SQL Lab → Explore
  # navigation flow under E2E. We diverge from the entrypoint on:
  #   --timeout 120: heavy dashboard import/export specs exceed the 60s
  #     default
  #   --max-requests / --max-requests-jitter: recycle the worker under
  #     test load to avoid leaks accumulating across the run
  #   superset.app:create_app(): explicit factory so we don't depend on
  #     FLASK_APP being exported
  nohup gunicorn \
    --bind "127.0.0.1:$port" \
    --workers 1 \
    --worker-class gthread \
    --threads 20 \
    --timeout 120 \
    --max-requests 500 \
    --max-requests-jitter 50 \
    --access-logfile - \
    --error-logfile - \
    "superset.app:create_app()" \
    >"$serverlog" 2>&1 </dev/null &
  local serverPid=$!

  # Ensure the backend is cleaned up and its log is emitted even when the
  # test runner fails under `set -e`.
  trap '
    echo "::group::gunicorn log for Cypress run"
    cat "'"$serverlog"'" || true
    echo "::endgroup::"
    kill '"$serverPid"' 2>/dev/null || true
  ' EXIT

  # Wait for the backend to be ready before launching Cypress; otherwise
  # the first spec can race the server bind and see connection errors.
  local timeout=60
  say "Waiting for gunicorn server to start on port $port..."
  while [ $timeout -gt 0 ]; do
    if curl -f "http://localhost:${port}${APP_ROOT}/health" >/dev/null 2>&1; then
      say "gunicorn server is ready"
      break
    fi
    sleep 1
    timeout=$((timeout - 1))
  done
  if [ $timeout -eq 0 ]; then
    echo "::error::gunicorn server failed to start within 60 seconds"
    echo "::group::Server startup log"
    cat "$serverlog"
    echo "::endgroup::"
    return 1
  fi

  USE_DASHBOARD_FLAG=''
  if [ "$USE_DASHBOARD" = "true" ]; then
    USE_DASHBOARD_FLAG='--use-dashboard'
  fi

  # UNCOMMENT the next few commands to monitor memory usage
  # monitor_memory &  # Start memory monitoring in the background
  # memoryMonitorPid=$!
  python ../../scripts/cypress_run.py --parallelism $PARALLELISM --parallelism-id $PARALLEL_ID --group $PARALLEL_ID --retries 5 $USE_DASHBOARD_FLAG
  # kill $memoryMonitorPid
}

playwright-install() {
  cd "$GITHUB_WORKSPACE/superset-frontend"

  say "::group::Install Playwright browsers"
  npx playwright install --with-deps chromium
  # Create output directories for test results and debugging
  mkdir -p playwright-results
  mkdir -p test-results
  say "::endgroup::"
}

playwright-run() {
  local APP_ROOT=$1
  local TEST_PATH=$2

  # Start the Superset backend via gunicorn from the project root.
  # See cypress-run-all() above for the rationale — the Flask dev server
  # cannot survive the dashboard import/export tests under load.
  cd "$GITHUB_WORKSPACE"
  local serverlog="${HOME}/superset-playwright.log"
  local port=8081
  # Use 127.0.0.1 explicitly: `flask run` binds IPv4 only, and Node's DNS
  # resolution for `localhost` can return `::1` first (IPv6), which then
  # refuses against the IPv4 listener and surfaces as
  # `connect ECONNREFUSED ::1:<port>` in API helpers driven from Node
  # (e.g., the embedded test app's exposed token fetcher).
  PLAYWRIGHT_BASE_URL="http://127.0.0.1:${port}"
  if [ -n "$APP_ROOT" ]; then
    export SUPERSET_APP_ROOT=$APP_ROOT
    PLAYWRIGHT_BASE_URL=${PLAYWRIGHT_BASE_URL}${APP_ROOT}/
  fi
  export PLAYWRIGHT_BASE_URL

  # See cypress-run-all() above for the args rationale (1 worker × 20
  # gthread threads matching docker/entrypoints/run-server.sh, plus a
  # 120s timeout and request-recycling for heavy E2E load).
  nohup gunicorn \
    --bind "127.0.0.1:$port" \
    --workers 1 \
    --worker-class gthread \
    --threads 20 \
    --timeout 120 \
    --max-requests 500 \
    --max-requests-jitter 50 \
    --access-logfile - \
    --error-logfile - \
    "superset.app:create_app()" \
    >"$serverlog" 2>&1 </dev/null &
  local serverPid=$!

  # Ensure cleanup on exit (and emit the server log on failure)
  trap '
    echo "::group::gunicorn log for Playwright run"
    cat "'"$serverlog"'" || true
    echo "::endgroup::"
    kill '"$serverPid"' 2>/dev/null || true
  ' EXIT

  # Wait for server to be ready with health check
  local timeout=60
  say "Waiting for gunicorn server to start on port $port..."
  while [ $timeout -gt 0 ]; do
    if curl -f ${PLAYWRIGHT_BASE_URL}/health >/dev/null 2>&1; then
      say "gunicorn server is ready"
      break
    fi
    sleep 1
    timeout=$((timeout - 1))
  done

  if [ $timeout -eq 0 ]; then
    echo "::error::gunicorn server failed to start within 60 seconds"
    echo "::group::Server startup log"
    cat "$serverlog"
    echo "::endgroup::"
    return 1
  fi

  # Change to frontend directory for Playwright execution
  cd "$GITHUB_WORKSPACE/superset-frontend"

  say "::group::Run Playwright tests"
  echo "Running Playwright with baseURL: ${PLAYWRIGHT_BASE_URL}"
  if [ -n "$TEST_PATH" ]; then
    # Check if there are any test files in the specified path
    if ! find "playwright/tests/${TEST_PATH}" -name "*.spec.ts" -type f 2>/dev/null | grep -q .; then
      echo "No test files found in ${TEST_PATH} - skipping test run"
      say "::endgroup::"
      return 0
    fi
    echo "Running tests: ${TEST_PATH}"
    # Set INCLUDE_EXPERIMENTAL=true to allow experimental tests to run
    export INCLUDE_EXPERIMENTAL=true
    npx playwright test "${TEST_PATH}" --output=playwright-results
    local status=$?
    # Unset to prevent leaking into subsequent commands
    unset INCLUDE_EXPERIMENTAL
  else
    echo "Running all required tests (experimental/ excluded via playwright.config.ts)"
    npx playwright test --output=playwright-results
    local status=$?
  fi
  say "::endgroup::"

  return $status
}

eyes-storybook-dependencies() {
  say "::group::install eyes-storyook dependencies"
  sudo apt-get update -y && sudo apt-get -y install gconf-service ca-certificates libxshmfence-dev fonts-liberation libappindicator3-1 libasound2 libatk-bridge2.0-0 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgbm1 libgcc1 libgconf-2-4 libglib2.0-0 libgdk-pixbuf2.0-0 libgtk-3-0 libnspr4 libnss3 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 lsb-release xdg-utils libappindicator1
  say "::endgroup::"
}

monitor_memory() {
  # This is a small utility to monitor memory usage. Useful for debugging memory in GHA.
  # To use wrap your command as follows
  #
  # monitor_memory &  # Start memory monitoring in the background
  # memoryMonitorPid=$!
  # YOUR_COMMAND_HERE
  # kill $memoryMonitorPid
  while true; do
    echo "$(date) - Top 5 memory-consuming processes:"
    ps -eo pid,comm,%mem --sort=-%mem | head -n 6  # First line is the header, next 5 are top processes
    sleep 2
  done
}
