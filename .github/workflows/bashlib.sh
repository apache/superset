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

# Rounded job start time, used to create a unique Cypress build id for
# parallelization so we can manually rerun a job after 20 minutes
NONCE=$(echo "$(date "+%Y%m%d%H%M") - ($(date +%M)%20)" | bc)

# Echo only when not in parallel mode
say() {
  if [[ $(echo "$INPUT_PARALLEL" | tr '[:lower:]' '[:upper:]') != 'TRUE' ]]; then
    echo "$1"
  fi
}

# default command to run when the `run` input is empty
default-setup-command() {
  apt-get-install
  pip-upgrade
}

apt-get-install() {
  say "::group::apt-get install dependencies"
  sudo apt-get update && sudo apt-get install --yes \
    libsasl2-dev
  say "::endgroup::"
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
  pip install -e .
  superset db upgrade
  superset load_test_users
  superset load_examples --load-test-data
  superset init
  say "::endgroup::"
}

codecov() {
  say "::group::Upload code coverage"
  bash ".github/workflows/codecov.sh" "$@"
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

# Run Cypress and upload coverage reports
cypress-run() {
  cd "$GITHUB_WORKSPACE/superset-frontend/cypress-base"

  local page=$1
  local group=${2:-Default}
  local cypress="./node_modules/.bin/cypress run"
  local browser=${CYPRESS_BROWSER:-chrome}

  export TERM="xterm"

  say "::group::Run Cypress for [$page]"
  if [[ -z $CYPRESS_KEY ]]; then
    $cypress --spec "cypress/integration/$page" --browser "$browser"
  else
    export CYPRESS_RECORD_KEY=$(echo $CYPRESS_KEY | base64 --decode)
    # additional flags for Cypress dashboard recording
    $cypress --spec "cypress/integration/$page" --browser "$browser" \
      --record --group "$group" --tag "${GITHUB_REPOSITORY},${GITHUB_EVENT_NAME}" \
      --parallel --ci-build-id "${GITHUB_SHA:0:8}-${NONCE}"
  fi

  # don't add quotes to $record because we do want word splitting
  say "::endgroup::"
}

cypress-run-all() {
  # Start Flask and run it in background
  # --no-debugger means disable the interactive debugger on the 500 page
  # so errors can print to stderr.
  local flasklog="${HOME}/flask.log"
  local port=8081
  export CYPRESS_BASE_URL="http://localhost:${port}"

  nohup flask run --no-debugger -p $port >"$flasklog" 2>&1 </dev/null &
  local flaskProcessId=$!

  cypress-run "*/**/*"

  # After job is done, print out Flask log for debugging
  say "::group::Flask log for default run"
  cat "$flasklog"
  say "::endgroup::"

  # Rerun SQL Lab tests with backend persist disabled
  export SUPERSET_CONFIG=tests.integration_tests.superset_test_config_sqllab_backend_persist_off

  # Restart Flask with new configs
  kill $flaskProcessId
  nohup flask run --no-debugger -p $port >"$flasklog" 2>&1 </dev/null &
  local flaskProcessId=$!

  cypress-run "sqllab/*" "Backend persist"

  # Upload code coverage separately so each page can have separate flags
  # -c will clean existing coverage reports, -F means add flags
  # || true to prevent CI failure on codecov upload
  codecov -c -F "cypress" || true

  say "::group::Flask log for backend persist"
  cat "$flasklog"
  say "::endgroup::"

  # make sure the program exits
  kill $flaskProcessId
}
