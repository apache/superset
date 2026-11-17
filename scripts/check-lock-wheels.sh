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

set -euo pipefail

# Verifies that every pin in the requirements locks has a prebuilt wheel for
# each supported Python minor on each supported Linux architecture, apart from
# the source-only packages listed in SDIST_ONLY below. It resolves each lock with
# `--only-binary :all:` for the whole matrix and reports every package that
# has no usable wheel, not just the first one uv names.
#
# Requires `uv` on PATH and must run from the repository root.

LOCKS=(
  requirements/base.txt
  requirements/development.txt
  requirements/translations.txt
)

# The supported Python minors, from the `requires-python` floor in
# pyproject.toml up to the newest supported release; keep in sync with the
# matrix in .github/workflows/python-lock-check.yml. "3.11" evaluates as python_full_version 3.11.0
# in uv, which is deliberate: that is the one patch release for which every
# 3.11-conditional pin applies (`python_full_version < '3.11.3'` and
# `<= '3.11'`), so the check covers the largest 3.11 set. A later patch
# release only drops pins, and the wheel tags are the same for all patches.
PYTHON_VERSIONS=(3.11 3.12 3.13 3.14)

PLATFORMS=(
  x86_64-manylinux_2_28
  aarch64-manylinux_2_28
)

# Known to publish only a source distribution on every Python version. These
# are skipped, so a wheel-less pin for any other package fails the check.
SDIST_ONLY='flask-testing|mysqlclient|odfpy|pydruid|pyhive|python-ldap|wtforms-json'

# Safety bound on the exclude-and-retry loop; far above the number of
# wheel-less pins a single lock is expected to have.
MAX_OFFENDERS=100

if ! command -v uv >/dev/null 2>&1; then
  echo "uv is required but was not found on PATH" >&2
  exit 1
fi

if [ ! -f pyproject.toml ] || [ ! -d requirements ]; then
  echo "Run this script from the repository root" >&2
  exit 1
fi

workdir=$(mktemp -d)
trap 'rm -rf "$workdir"' EXIT

failures=0
combinations=0

# Prints the package name uv blames, or nothing if the message names none.
# uv words the reason differently when a release has no wheels at all ("has no
# usable wheels") and when it has wheels but none for the requested interpreter
# or platform ("has no wheels with a matching Python ABI tag", "... platform
# tag", and similar).
named_offender() {
  sed -nE 's/.*Because ([A-Za-z0-9_.-]+)==[^ ]+ has no (usable wheels|wheels with a matching).*/\1/p' "$1" | head -n 1
}

check_combination() {
  local lock=$1 python_version=$2 platform=$3
  local label="${lock} on Python ${python_version} (${platform})"
  local reqs="${workdir}/reqs.txt"
  local err="${workdir}/err.txt"
  local offenders=()
  local attempt offender

  # `-e` lines are local editable paths (superset-core and the like) that are
  # built from this checkout, not downloaded as wheels.
  grep -v '^-e' "$lock" | grep -Ev "^(${SDIST_ONLY})==" >"$reqs" || true

  for ((attempt = 0; attempt <= MAX_OFFENDERS; attempt++)); do
    if uv pip compile "$reqs" --no-deps --only-binary :all: \
      --python-version "$python_version" --python-platform "$platform" \
      --no-header --no-annotate -q >/dev/null 2>"$err"; then
      break
    fi

    offender=$(named_offender "$err")
    if [ -z "$offender" ] || [ "${#offenders[@]}" -ge "$MAX_OFFENDERS" ]; then
      # uv failed for a reason other than a missing wheel (or the loop did not
      # converge); show its message so the failure is actionable.
      echo "FAIL ${label}" >&2
      sed 's/^/    /' "$err" >&2
      offenders+=("<unresolved: see uv message above>")
      break
    fi

    offenders+=("$offender")
    grep -Ev "^${offender}==" "$reqs" >"${reqs}.next" || true
    if cmp -s "$reqs" "${reqs}.next"; then
      # uv named a package under a spelling the lock does not use, so nothing
      # was removed and retrying would repeat the same failure.
      echo "FAIL ${label}" >&2
      sed 's/^/    /' "$err" >&2
      break
    fi
    mv "${reqs}.next" "$reqs"
  done

  if [ "${#offenders[@]}" -gt 0 ]; then
    echo "FAIL ${label}: no usable wheel for: ${offenders[*]}" >&2
    return 1
  fi
  echo "ok   ${label}"
}

for lock in "${LOCKS[@]}"; do
  for python_version in "${PYTHON_VERSIONS[@]}"; do
    for platform in "${PLATFORMS[@]}"; do
      combinations=$((combinations + 1))
      if ! check_combination "$lock" "$python_version" "$platform"; then
        failures=$((failures + 1))
      fi
    done
  done
done

if [ "$failures" -gt 0 ]; then
  echo "${failures} of ${combinations} lock/Python/platform combinations lack wheels" >&2
  exit 1
fi
echo "All ${combinations} lock/Python/platform combinations have wheels"
