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
# Regression tests for frontend-mem-nag.sh (apache/superset#46368):
# the script must warn on the memory available to the *container*
# (cgroup limit minus usage) when that is lower than the host's
# available memory, instead of reporting host memory.
#
# Usage: bash docker/frontend-mem-nag.test.sh [path/to/frontend-mem-nag.sh]
# The script under test is driven through the MEMINFO_PATH / CGROUP_PATH
# overrides it supports, so the tests run anywhere bash runs (no
# container or mount namespace needed). End-to-end proof against the
# real /proc/meminfo and /sys/fs/cgroup paths is in the PR description:
# the unpatched script reported host memory (7.63 GB) inside a
# 1 GiB-limited container, the patched script warns with ~0.80 GiB.

set -euo pipefail

SCRIPT="${1:-$(cd "$(dirname "$0")" && pwd)/frontend-mem-nag.sh}"
TMPDIR="$(mktemp -d)"
trap 'rm -rf "${TMPDIR}"' EXIT
FAILURES=0

# run_case <name> <meminfo contents> <cgroup setup> <expected patterns...>
# cgroup setup is one of: none | v2-max | v2-limit:<max>:<current> |
# v1-files:<limit>:<usage>
run_case() {
  local name="$1" meminfo="$2" cgroup="$3"
  shift 3
  local meminfo_path="${TMPDIR}/meminfo" cgroup_path="${TMPDIR}/cgroup"
  rm -rf "${cgroup_path}"
  mkdir -p "${cgroup_path}"
  printf '%s\n' "${meminfo}" > "${meminfo_path}"
  case "${cgroup}" in
    none) ;;
    v2-max)
      printf 'max\n' > "${cgroup_path}/memory.max"
      printf '0\n' > "${cgroup_path}/memory.current"
      ;;
    v2-limit:*)
      printf '%s\n' "${cgroup#v2-limit:}" | cut -d: -f1 > "${cgroup_path}/memory.max"
      printf '%s\n' "${cgroup#v2-limit:}" | cut -d: -f2 > "${cgroup_path}/memory.current"
      ;;
    v1-files:*)
      # cgroups v1 files are no longer read: a v1-only container falls
      # back to the host value.
      printf '%s\n' "${cgroup#v1-files:}" | cut -d: -f1 > "${cgroup_path}/memory.limit_in_bytes"
      printf '%s\n' "${cgroup#v1-files:}" | cut -d: -f2 > "${cgroup_path}/memory.usage_in_bytes"
      ;;
    *) echo "unknown cgroup setup: ${cgroup}" >&2; exit 1 ;;
  esac
  local output
  output="$(MEMINFO_PATH="${meminfo_path}" CGROUP_PATH="${cgroup_path}" bash "${SCRIPT}")"
  local pattern
  for pattern in "$@"; do
    if [[ "${pattern}" == "!"* ]]; then
      if echo "${output}" | grep -q "${pattern#!}"; then
        echo "FAIL: ${name}: unexpected '${pattern#!}' in output: ${output}"
        FAILURES=$((FAILURES + 1))
      fi
    else
      if ! echo "${output}" | grep -q "${pattern}"; then
        echo "FAIL: ${name}: expected '${pattern}' in output: ${output}"
        FAILURES=$((FAILURES + 1))
      fi
    fi
  done
  echo "ok: ${name}"
}

HOST_8GB=$'MemTotal:       8124900 kB\nMemFree:        1000000 kB\nMemAvailable:   8000000 kB'
HOST_2GB=$'MemTotal:       8124900 kB\nMemFree:        1000000 kB\nMemAvailable:   2000000 kB'
HOST_8GB_NOFREE=$'MemTotal:       8124900 kB\nMemFree:        8000000 kB'

# cgroup v2 limit 1 GiB, usage 0.2 GiB, host 8 GiB -> warn with ~0.80 GiB left
run_case "v2 limit below host" "${HOST_8GB}" "v2-limit:1073741824:209715200" \
  "Memory Insufficient Warning" "0.804688"
# cgroup v2 unlimited ("max"), host 8 GiB -> no warning, host value reported
run_case "v2 unlimited" "${HOST_8GB}" "v2-max" \
  "Memory available: 7.62939" "!Memory Insufficient Warning"
# cgroup v2 limit 8 GiB, host 2 GiB -> host value wins, warn with ~1.91 GiB
run_case "v2 limit above host" "${HOST_2GB}" "v2-limit:8589934592:0" \
  "Memory Insufficient Warning" "1.90735"
# cgroup v1 files present, no v2 files: v1 is no longer supported, so the
# host value is reported and no warning is shown even though the v1 limit
# (1 GiB) is below the host's available memory
run_case "v1 files ignored" "${HOST_8GB}" "v1-files:1073741824:104857600" \
  "Memory available: 7.62939" "!Memory Insufficient Warning"
# no cgroup files at all, host 8 GiB -> no warning, host value reported
run_case "no cgroup files" "${HOST_8GB}" "none" \
  "Memory available: 7.62939" "!Memory Insufficient Warning"
# no MemAvailable line (MemFree fallback), v2 limit 1 GiB -> warn ~0.80 GiB
run_case "MemFree fallback with v2 limit" "${HOST_8GB_NOFREE}" "v2-limit:1073741824:209715200" \
  "Memory Insufficient Warning" "0.804688"

if [[ "${FAILURES}" -gt 0 ]]; then
  echo "${FAILURES} case(s) failed"
  exit 1
fi
echo "All frontend-mem-nag.sh regression tests passed"
