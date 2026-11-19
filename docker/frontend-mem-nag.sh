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

echo_mem_warn() {
  # Check if running in Codespaces first
  if [[ -n "${CODESPACES}" ]]; then
    echo "Memory available: Codespaces managed"
    return
  fi

  # Allow memory fixtures to be used without Docker.
  local meminfo_file="${MEMINFO_FILE:-/proc/meminfo}"

  # Check platform and get memory accordingly
  if [[ -f "$meminfo_file" ]]; then
    # Linux
    if grep -q MemAvailable "$meminfo_file"; then
      MEM_AVAIL_KB=$(awk '/MemAvailable/ { printf "%s \n", $2 }' "$meminfo_file")
    else
      MEM_AVAIL_KB=$(awk '/MemFree/ { printf "%s \n", $2 }' "$meminfo_file")
    fi

    local cgroup_root="${CGROUP_ROOT:-/sys/fs/cgroup}"
    local limit_file usage_file limit usage cgroup_v1=0
    if [[ -f "$cgroup_root/memory.max" ]]; then
      limit_file="$cgroup_root/memory.max"
      usage_file="$cgroup_root/memory.current"
    else
      cgroup_v1=1
      limit_file="$cgroup_root/memory/memory.limit_in_bytes"
      usage_file="$cgroup_root/memory/memory.usage_in_bytes"
    fi

    # Missing, unreadable or unlimited cgroup values leave host memory unchanged.
    if limit=$(cat "$limit_file" 2>/dev/null) &&
       usage=$(cat "$usage_file" 2>/dev/null) &&
       [[ "$limit" =~ ^[0-9]+$ && "$usage" =~ ^[0-9]+$ ]]; then
      MEM_AVAIL_KB=$(awk -v host="$MEM_AVAIL_KB" -v limit="$limit" \
        -v usage="$usage" -v v1="$cgroup_v1" 'BEGIN {
          # Cgroup v1 uses a huge limit (near LONG_MAX) for unlimited memory.
          if (!v1 || limit < 1152921504606846976) {
            remaining = int((limit - usage) / 1024)
            if (remaining < 0) remaining = 0
            if (remaining < host) host = remaining
          }
          printf "%.0f\n", host
        }')
    fi
    MEM_AVAIL_GB=$(awk -v available="$MEM_AVAIL_KB" 'BEGIN { printf "%s \n", available/1024/1024 }')
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
    memory ${MEM_TYPE}. Please increase your Docker
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
