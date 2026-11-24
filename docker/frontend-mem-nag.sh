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

# We need at least 3GB of free mem...
MIN_MEM_FREE_GB=3
MIN_MEM_FREE_KB=$(($MIN_MEM_FREE_GB*1000000))

# Paths below can be overridden for testing (e.g. by
# docker/frontend-mem-nag.test.sh); defaults are the live system paths.
MEMINFO_PATH="${MEMINFO_PATH:-/proc/meminfo}"
CGROUP_PATH="${CGROUP_PATH:-/sys/fs/cgroup}"

# Echo the memory available to this container in KiB: the lower of the
# host's available memory and the remaining cgroup memory limit, when a
# finite cgroup v2 limit is configured. Falls back to the host value when
# no cgroup limit applies (not running in a container, unlimited limit, or
# cgroup files unreadable), so behaviour outside containers is unchanged.
container_mem_avail_kb() {
  local host_kb="$1"
  local limit_bytes="" usage_bytes=0 remaining_kb=""
  if [[ -f "${CGROUP_PATH}/memory.max" ]]; then
    # cgroups v2: "max" means no limit
    local max_value
    max_value=$(cat "${CGROUP_PATH}/memory.max")
    if [[ "${max_value}" =~ ^[0-9]+$ ]]; then
      limit_bytes="${max_value}"
    fi
    if [[ -f "${CGROUP_PATH}/memory.current" ]]; then
      local current_value
      current_value=$(cat "${CGROUP_PATH}/memory.current")
      if [[ "${current_value}" =~ ^[0-9]+$ ]]; then
        usage_bytes="${current_value}"
      fi
    fi
  fi
  if [[ -n "${limit_bytes}" ]]; then
    remaining_kb=$(( (limit_bytes - usage_bytes) / 1024 ))
    if [[ "${remaining_kb}" -lt 0 ]]; then
      remaining_kb=0
    fi
    if [[ "${remaining_kb}" -lt "${host_kb}" ]]; then
      echo "${remaining_kb}"
      return
    fi
  fi
  echo "${host_kb}"
}

echo_mem_warn() {
  # Check if running in Codespaces first
  if [[ -n "${CODESPACES}" ]]; then
    echo "Memory available: Codespaces managed"
    return
  fi

  # Check platform and get memory accordingly
  if [[ -f "${MEMINFO_PATH}" ]]; then
    # Linux
    if grep -q MemAvailable "${MEMINFO_PATH}"; then
      MEM_AVAIL_KB=$(awk '/MemAvailable/ { printf "%s \n", $2 }' "${MEMINFO_PATH}")
    else
      MEM_AVAIL_KB=$(awk '/MemFree/ { printf "%s \n", $2 }' "${MEMINFO_PATH}")
    fi
    # A container memory limit can leave less memory than the host reports,
    # so warn on the lower of the two.
    MEM_AVAIL_KB=$(container_mem_avail_kb "${MEM_AVAIL_KB}")
    MEM_AVAIL_GB=$(awk -v kb="${MEM_AVAIL_KB}" 'BEGIN { printf "%s \n", kb/1024/1024 }')
  elif [[ "$(uname)" == "Darwin" ]]; then
    # macOS - use vm_stat to get free memory
    # vm_stat reports in pages, typically 4096 bytes per page
    PAGE_SIZE=$(pagesize)
    FREE_PAGES=$(vm_stat | awk '/Pages free:/ {print $3}' | tr -d '.')
    INACTIVE_PAGES=$(vm_stat | awk '/Pages inactive:/ {print $3}' | tr -d '.')
    # Free + inactive pages give us available memory (similar to MemAvailable on Linux)
    AVAIL_PAGES=$((FREE_PAGES + INACTIVE_PAGES))
    MEM_AVAIL_KB=$((AVAIL_PAGES * PAGE_SIZE / 1024))
    MEM_AVAIL_GB=$(echo "scale=2; $MEM_AVAIL_KB / 1024 / 1024" | bc)
  else
    # Other platforms
    echo "Memory available: Unable to determine"
    return
  fi

  if [[ "${MEM_AVAIL_KB}" -lt "${MIN_MEM_FREE_KB}" ]]; then
    cat <<EOF
    ===============================================
    ========  Memory Insufficient Warning =========
    ===============================================

    It looks like you only have ${MEM_AVAIL_GB}GB of
    memory. Please increase your Docker
    resources to at least ${MIN_MEM_FREE_GB}GB

    Note: During builds, available memory may be
    temporarily low due to caching and compilation.

    ===============================================
    ========  Memory Insufficient Warning =========
    ===============================================
EOF
  else
    echo "Memory available: ${MEM_AVAIL_GB} GB"
  fi
}

# Always nag if they're low on mem...
echo_mem_warn
