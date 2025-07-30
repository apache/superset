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
    echo "Memory check Ok [Codespaces environment - memory dynamically allocated]"
    return
  fi

  # Check if /proc/meminfo exists (Linux)
  if [[ ! -f /proc/meminfo ]]; then
    # Not on Linux or /proc not mounted, skip the check
    echo "Memory check skipped [/proc/meminfo not available]"
    return
  fi

  # Use MemAvailable if present (more accurate), fall back to MemFree
  if grep -q MemAvailable /proc/meminfo; then
    MEM_AVAIL_KB=$(awk '/MemAvailable/ { printf "%s \n", $2 }' /proc/meminfo)
    MEM_AVAIL_GB=$(awk '/MemAvailable/ { printf "%s \n", $2/1024/1024 }' /proc/meminfo)
    MEM_TYPE="available"
  else
    MEM_AVAIL_KB=$(awk '/MemFree/ { printf "%s \n", $2 }' /proc/meminfo)
    MEM_AVAIL_GB=$(awk '/MemFree/ { printf "%s \n", $2/1024/1024 }' /proc/meminfo)
    MEM_TYPE="free"
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
    echo "Memory check Ok [${MEM_AVAIL_GB}GB ${MEM_TYPE}]"
  fi
}

# Always nag if they're low on mem...
echo_mem_warn
