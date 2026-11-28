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
set -e

# Temporary fix, probably related with https://bugs.launchpad.net/ubuntu/+source/opencv/+bug/1890170
# MySQL was failing with:
# from . import _mysql
# ImportError: /lib/x86_64-linux-gnu/libstdc++.so.6: cannot allocate memory in static TLS block
export LD_PRELOAD=/lib/x86_64-linux-gnu/libstdc++.so.6
export SUPERSET_CONFIG=${SUPERSET_CONFIG:-tests.integration_tests.superset_test_config}
export SUPERSET_TESTENV=true
# PYTEST_WORKERS > 1 runs the suite under pytest-xdist with one metadata
# database, examples database, Redis database range and Celery worker per
# xdist worker (see tests/integration_tests/superset_test_config.py and the
# celery-worker helper in .github/workflows/bashlib.sh). The per-worker
# databases must already exist for server backends (bashlib's setup-postgres
# and setup-mysql create them); this script migrates and seeds each one.
PYTEST_WORKERS="${PYTEST_WORKERS:-1}"

echo "Superset config module: $SUPERSET_CONFIG"

prepare_metadata_db() {
  superset db upgrade
  superset init
  superset load-test-users
}

if [ "$PYTEST_WORKERS" -gt 1 ]; then
  echo "Preparing $PYTEST_WORKERS per-worker metadata databases"
  pids=()
  for i in $(seq 0 $((PYTEST_WORKERS - 1))); do
    (
      export PYTEST_XDIST_WORKER="gw$i"
      prepare_metadata_db > "/tmp/prepare-metadata-gw$i.log" 2>&1
    ) &
    pids+=($!)
  done
  failed=0
  for i in "${!pids[@]}"; do
    if ! wait "${pids[$i]}"; then
      echo "::error::metadata database preparation failed for worker gw$i"
      cat "/tmp/prepare-metadata-gw$i.log"
      failed=1
    fi
  done
  [ "$failed" -eq 0 ] || exit 1

  echo "Running tests on $PYTEST_WORKERS xdist workers"
  # --dist loadfile keeps every test of one file on one worker, preserving
  # module-scoped fixture state and in-file ordering.
  pytest -n "$PYTEST_WORKERS" --dist loadfile --durations-min=2 --cov-report= --cov=superset ./tests/integration_tests "$@"
else
  prepare_metadata_db

  echo "Running tests"
  pytest --durations-min=2 --cov-report= --cov=superset ./tests/integration_tests "$@"
fi
