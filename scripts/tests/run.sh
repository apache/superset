#!/usr/bin/env bash

# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.

set -e

#
# Reset test DATABASE
#
function reset_db() {
  echo --------------------
  echo Resetting test DB
  echo --------------------
  docker compose stop superset-tests-worker superset || true
  RESET_DB_CMD="psql \"postgresql://${DB_USER}:${DB_PASSWORD}@127.0.0.1:5432\" <<-EOF
    DROP DATABASE IF EXISTS ${DB_NAME};
    CREATE DATABASE ${DB_NAME};
    \\c ${DB_NAME}
    DROP SCHEMA IF EXISTS sqllab_test_db;
    CREATE SCHEMA sqllab_test_db;
    DROP SCHEMA IF EXISTS admin_database;
    CREATE SCHEMA admin_database;
EOF
"
  docker exec -i superset_db bash -c "${RESET_DB_CMD}"
  docker compose start superset-tests-worker superset
}

#
# Run init test procedures
#
function test_init() {
  echo --------------------
  echo Upgrading
  echo --------------------
  superset db upgrade
  echo --------------------
  echo Superset init
  echo --------------------
  superset init
}

#
# Init global vars
#
DB_NAME="test"
DB_USER="superset"
DB_PASSWORD="superset"

# Pointing to use the test database in local docker-compose setup
export SUPERSET__SQLALCHEMY_DATABASE_URI=${SUPERSET__SQLALCHEMY_DATABASE_URI:-postgresql+psycopg2://"${DB_USER}":"${DB_PASSWORD}"@localhost/"${DB_NAME}"}

export SUPERSET_CONFIG=${SUPERSET_CONFIG:-tests.integration_tests.superset_test_config}
RUN_INIT=1
RUN_RESET_DB=1
RUN_TESTS=1
TEST_MODULE="tests"

PARAMS=""
while (( "$#" )); do
  case "$1" in
    --help)
      echo Switches:
      echo --no-init : Will not, reset the test DB, superset init and load examples
      echo --no-reset-db: Will not reset the test DB
      echo --no-tests: Will not run any test, by default reset the DB, superset init and load_examples
      echo --reset-db: Just resets the test DB, will not run any test
      echo --module: Run a specific test module: --module tests/charts/api_tests.py for example
      exit 0
      ;;
    --no-init)
      RUN_INIT=0
      RUN_RESET_DB=0
      shift 1
      ;;
    --no-reset-db)
      RUN_RESET_DB=0
      shift 1
      ;;
    --no-tests)
      RUN_TESTS=0
      shift 1
      ;;
    --reset-db)
      RUN_TESTS=0
      RUN_INIT=0
      shift 1
      ;;
    --module)
      TEST_MODULE=$2
      shift 2
      ;;
    --) # end argument parsing
      shift
      break
      ;;
    --*) # unsupported flags
      echo "Error: Unsupported flag $1" >&2
      exit 1
      ;;
    *) # preserve positional arguments
      PARAMS="$PARAMS $1"
      shift
      ;;
  esac
done

echo ------------------------------------
echo DB_URI="${SUPERSET__SQLALCHEMY_DATABASE_URI}"
echo Superset config module="${SUPERSET_CONFIG}"
echo Run init procedures=$RUN_INIT
echo Run reset DB=$RUN_RESET_DB
echo Test to run:"${TEST_MODULE}"
echo ------------------------------------


if [ $RUN_RESET_DB -eq 1 ]
then
  reset_db
fi

if [ $RUN_INIT -eq 1 ]
then
  test_init
fi

if [ $RUN_TESTS -eq 1 ]
then
  pytest -vv --durations=0 "${TEST_MODULE}"
fi
