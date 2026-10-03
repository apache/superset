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

# Computes the `--extra-flags` value passed to `supersetbot docker` for a
# given build preset. Factored out of .github/workflows/docker.yml so the
# PY_VER override logic below can be exercised by an always-on CI check
# (docker.yml's docker-build job only runs when the change detector's
# docker/python/frontend outputs are true, and the PR build matrix never
# includes py311/py312 at all, so a regression here would otherwise go
# unnoticed until the fix actually runs on master) without duplicating -
# and risking drift from - the logic used by the real build step.
#
# supersetbot's "py311"/"py312" presets pin their own --build-arg PY_VER,
# which lands ahead of --extra-flags on the assembled buildx command line;
# docker/buildx keeps the last value for a repeated --build-arg key, so
# appending PY_VER here would override supersetbot's pin and silently make
# "py311"/"py312" build the exact same image as "lean". Every other preset
# gets the override so its build lands on the Dockerfile's own supported
# Python version. Those presets also point buildx at a matching cache tag so
# local and CI builds can pull cache layers for the same base image they build.
#
# Usage: docker-build-extra-flags.sh <build_preset> [image_tag] [release]
#
# Reads RELEASE_BRANCH_TAG from the environment (set by
# scripts/docker-build-plan.sh) to add the commit-addressable tag a
# release-branch push publishes.

set -euo pipefail

BUILD_PRESET="${1:?usage: docker-build-extra-flags.sh <build_preset> [image_tag]}"
IMAGE_TAG="${2:-}"
BUILD_MODE="${3:-ci}"
DEFAULT_PY_VER="$(sed -n 's/^ARG PY_VER=//p' Dockerfile | head -n 1)"
if [ -z "$DEFAULT_PY_VER" ]; then
  echo "Could not determine the default PY_VER from Dockerfile" >&2
  exit 1
fi

EXTRA_FLAGS=""
if [ "$BUILD_MODE" = "ci" ]; then
  EXTRA_FLAGS="--build-arg INCLUDE_CHROMIUM=false"
elif [ "$BUILD_MODE" != "release" ]; then
  echo "Unknown Docker build mode: $BUILD_MODE" >&2
  exit 1
fi
if [ -n "$IMAGE_TAG" ]; then
  EXTRA_FLAGS="${EXTRA_FLAGS:+$EXTRA_FLAGS }--tag $IMAGE_TAG"
fi

# `superset` owns the unsuffixed tag and cache ref; every other preset is
# suffixed, matching supersetbot's own scheme (master-dev, 6.1.0-py311).
PRESET_SUFFIX=""
if [ "$BUILD_PRESET" != "superset" ]; then
  PRESET_SUFFIX="-$BUILD_PRESET"
fi

# Commit-addressable tag for a release-branch push, e.g. 7.0-a1b2c3d[-lean].
# Emitted by scripts/docker-build-plan.sh and exported by docker.yml, the same
# way PUBLISH_DOCKER_CACHE is. supersetbot derives a branch tag only for master,
# so this is what makes a release-branch push addressable on Docker Hub. The
# preset suffix is what stops the matrix legs racing on a single tag.
if [ -n "${RELEASE_BRANCH_TAG:-}" ]; then
  EXTRA_FLAGS="${EXTRA_FLAGS:+$EXTRA_FLAGS }--tag apache/superset:${RELEASE_BRANCH_TAG}${PRESET_SUFFIX}"
fi

case "$BUILD_PRESET" in
  py311)
    CACHE_REF="apache/superset-cache:3.11-slim-bookworm"
    ;;
  py312)
    CACHE_REF="apache/superset-cache:3.12-slim-bookworm"
    ;;
  *)
    # Keep the superset cache ref for Compose consumers; isolate other
    # matrix targets so concurrent exports cannot overwrite its layers.
    CACHE_REF="apache/superset-cache:${DEFAULT_PY_VER}${PRESET_SUFFIX}"
    EXTRA_FLAGS="--build-arg PY_VER=$DEFAULT_PY_VER${EXTRA_FLAGS:+ $EXTRA_FLAGS}"
    ;;
esac

EXTRA_FLAGS="--cache-from=type=registry,ref=$CACHE_REF $EXTRA_FLAGS"
if [ "${PUBLISH_DOCKER_CACHE:-}" = "true" ] && [ -n "${DOCKERHUB_TOKEN:-}" ]; then
  EXTRA_FLAGS="--cache-to=type=registry,mode=max,ref=$CACHE_REF $EXTRA_FLAGS"
fi

echo "$EXTRA_FLAGS"
