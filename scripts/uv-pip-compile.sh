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

# If not already running in Docker, run this script inside Docker
if [ -z "$RUNNING_IN_DOCKER" ]; then
  # Extract "current" Python version from CI config (single source of truth)
  PYTHON_VERSION=$(grep -A 1 'if.*"current"' .github/actions/setup-backend/action.yml | grep 'RESOLVED_VERSION=' | sed 's/.*RESOLVED_VERSION="\([0-9.]*\)".*/\1/')

  if [ -z "$PYTHON_VERSION" ]; then
    echo "Failed to determine Python version from .github/actions/setup-backend/action.yml" >&2
    exit 1
  fi

  echo "Running in Docker (Python ${PYTHON_VERSION} on Linux)..."

  IMAGE="python:${PYTHON_VERSION}-slim"

  # Pre-pull the image with a few retries to absorb transient Docker Hub
  # registry failures ("context deadline exceeded" / anonymous rate-limit blips
  # on shared CI runners). Without this a flaky pull fails the whole
  # check-python-deps job on an infrastructure hiccup rather than a real
  # dependency drift. The pull is in the `until` condition so `set -e` does not
  # abort on an individual failed attempt.
  attempt=1
  max_attempts=4
  until docker pull "$IMAGE"; do
    if [ "$attempt" -ge "$max_attempts" ]; then
      echo "docker pull $IMAGE failed after ${max_attempts} attempts" >&2
      exit 1
    fi
    delay=$((attempt * 10))
    echo "docker pull $IMAGE failed (attempt ${attempt}/${max_attempts}); retrying in ${delay}s..." >&2
    sleep "$delay"
    attempt=$((attempt + 1))
  done

  docker run --rm \
    -v "$(pwd)":/app \
    -w /app \
    -e RUNNING_IN_DOCKER=1 \
    "$IMAGE" \
    bash -c "pip install uv && ./scripts/uv-pip-compile.sh $*"

  exit $?
fi

ADDITIONAL_ARGS="$@"

# Generate the requirements/base.txt file
uv pip compile pyproject.toml requirements/base.in -o requirements/base.txt $ADDITIONAL_ARGS

# Hack to remove "Unnamed requirements are not allowed as constraints" error from base requirements
grep --invert-match "./superset-core" requirements/base.txt > requirements/base-constraint.txt

# Generate the requirements/development.txt file, making sure the base requirements are used as a constraint to keep the versions in sync. Note that `development.txt` is a Superset of `base.txt` where version for the shared libs should match their version.
uv pip compile requirements/development.in -c requirements/base-constraint.txt -o requirements/development.txt $ADDITIONAL_ARGS

# Remove temporary base requirement file
rm requirements/base-constraint.txt

# NOTE translation is intended as a "supplemental" set of pins that can be combined with either base or dev as needed
uv pip compile requirements/translations.in -o requirements/translations.txt $ADDITIONAL_ARGS
