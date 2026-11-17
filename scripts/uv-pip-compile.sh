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

# Superset supports every Python minor from the `requires-python` floor up, so
# the lock is compiled as a universal resolution from that floor. Derive the
# floor before the Docker guard so the host (which picks the image) and the
# container re-invocation (which passes it to uv) read the same value from the
# same pyproject.toml.
PYTHON_FLOOR=$(sed -nE 's/^requires-python[[:space:]]*=[[:space:]]*">=[[:space:]]*([0-9]+\.[0-9]+).*/\1/p' pyproject.toml | head -n 1)

if ! [[ "$PYTHON_FLOOR" =~ ^3\.[0-9]+$ ]]; then
  echo "Failed to derive a Python floor of the form 3.N from the requires-python lower bound in pyproject.toml (got '${PYTHON_FLOOR}')" >&2
  exit 1
fi

# If not already running in Docker, run this script inside Docker
if [ -z "$RUNNING_IN_DOCKER" ]; then
  echo "Running in Docker (Python ${PYTHON_FLOOR} on Linux)..."

  IMAGE="python:${PYTHON_FLOOR}-slim"

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
    bash -c "pip install 'uv==0.12.3' && ./scripts/uv-pip-compile.sh $*"

  exit $?
fi

ADDITIONAL_ARGS="$@"

# pyproject.toml's `[tool.uv] environments` bounds the universal resolution to
# non-Windows platforms. uv renders that bound as a marker on every line (and
# ANDs it into the other markers), which is noise when it holds for the whole
# lock, so strip it. Markers that differ between lines, such as
# `python_full_version < '3.14'`, are left alone. The pinned uv version matters
# here: the patterns match the text that version renders.
strip_environment_bound() {
  sed -E -i "s/ and sys_platform != 'win32'$//; s/ ; sys_platform != 'win32'$//" "$1"
}

compile_all() {
  # Generate the requirements/base.txt file
  uv pip compile pyproject.toml requirements/base.in -o requirements/base.txt --universal --python-version "$PYTHON_FLOOR" $ADDITIONAL_ARGS
  strip_environment_bound requirements/base.txt

  # Hack to remove "Unnamed requirements are not allowed as constraints" error from base requirements.
  # Derived after the strip so the constraint matches the committed base.txt that the next run sees.
  grep --invert-match "./superset-core" requirements/base.txt > requirements/base-constraint.txt

  # Generate the requirements/development.txt file, making sure the base requirements are used as a constraint to keep the versions in sync. Note that `development.txt` is a Superset of `base.txt` where version for the shared libs should match their version.
  uv pip compile requirements/development.in -c requirements/base-constraint.txt -o requirements/development.txt --universal --python-version "$PYTHON_FLOOR" $ADDITIONAL_ARGS
  strip_environment_bound requirements/development.txt

  # Remove temporary base requirement file
  rm requirements/base-constraint.txt

  # NOTE translation is intended as a "supplemental" set of pins that can be combined with either base or dev as needed
  uv pip compile requirements/translations.in -o requirements/translations.txt --universal --python-version "$PYTHON_FLOOR" $ADDITIONAL_ARGS
  strip_environment_bound requirements/translations.txt
}

lock_checksum() {
  cksum requirements/base.txt requirements/development.txt requirements/translations.txt
}

# A universal compile reads the previous output as its version preferences, and
# the first pass over a lock written by an earlier compile does not land on a
# fixed point. check-python-deps.yml reruns this script and fails on any diff,
# so repeat until a pass leaves the lock unchanged.
max_passes=5
pass=1
while true; do
  before=$(lock_checksum)
  compile_all
  if [ "$before" = "$(lock_checksum)" ]; then
    break
  fi
  if [ "$pass" -ge "$max_passes" ]; then
    echo "requirements/*.txt did not converge after ${max_passes} compile passes" >&2
    exit 1
  fi
  pass=$((pass + 1))
done
