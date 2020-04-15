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

function restart_docker() {
  docker-compose -f "${SCRIPT_DIR}"/docker-compose.yml down
  docker-compose -f "${SCRIPT_DIR}"/docker-compose.yml up -d --force-recreate
  # Bad way to wait for the db's to start
  sleep 5
}

function test_init() {
  echo --------------------
  echo Upgrading
  echo --------------------
  superset db upgrade
  echo --------------------
  echo Superset init
  echo --------------------
  superset init
  echo --------------------
  echo Load examples
  echo --------------------
  nosetests tests/load_examples_test.py
}


SCRIPT_DIR=$(dirname "$0")

if [[ "$#" -eq  "0" ]]
then
  echo "No argument suplied"
  echo ------------------------
  echo use:
  echo "run.sh <test module name> [options]"
  echo "[options]:"
  echo "--mysql: Use MySQL container on tests"
  echo "--no-init: Dont restart docker and no db migrations, superset init and test data"
  echo "--no-docker: Dont restart docker"
  exit 1
fi

export SUPERSET__SQLALCHEMY_DATABASE_URI=${SUPERSET__SQLALCHEMY_DATABASE_URI:-postgresql+psycopg2://postgresuser:pguserpassword@localhost/superset}
export SUPERSET_CONFIG=${SUPERSET_CONFIG:-tests.superset_test_config}
RUN_INIT=1
RUN_DOCKER=1
TEST_MODULE="${1}"
shift 1

PARAMS=""
while (( "$#" )); do
  case "$1" in
    --mysql)
      export SUPERSET__SQLALCHEMY_DATABASE_URI="mysql://mysqluser:mysqluserpassword@localhost/superset?charset=utf8"
      shift 1
      ;;
    --no-init)
      RUN_INIT=0
      RUN_DOCKER=0
      shift 1
      ;;
    --no-docker)
      RUN_DOCKER=0
      shift 1
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
echo Run Docker=$RUN_DOCKER
echo Test to run:"${TEST_MODULE}"
echo ------------------------------------


if [ $RUN_DOCKER -eq 1 ]
then
  restart_docker
fi

if [ $RUN_INIT -eq 1 ]
then
  test_init
fi

nosetests --exclude=load_examples_test "${TEST_MODULE}"
