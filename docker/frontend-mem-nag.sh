#!/usr/bin/env bash

set -e

# We need at least 3GB of free mem...
MIN_MEM_FREE_GB=3
MIN_MEM_FREE_KB=$(($MIN_MEM_FREE_GB*1000000))

echo_mem_warn() {
  MEM_FREE_KB=$(awk '/MemFree/ { printf "%s \n", $2 }' /proc/meminfo)
  MEM_FREE_GB=$(awk '/MemFree/ { printf "%s \n", $2/1024/1024 }' /proc/meminfo)

  if [[ "${MEM_FREE_KB}" -lt "${MIN_MEM_FREE_KB}" ]]; then
    cat <<EOF
    ===============================================
    ========  Memory Insufficient Warning =========
    ===============================================

    It looks like you only have ${MEM_FREE_GB}GB of
    memory free. Please increase your Docker
    resources to at least ${MIN_MEM_FREE_GB}GB

    ===============================================
    ========  Memory Insufficient Warning =========
    ===============================================
EOF
  else
    echo "Memory check Ok [${MEM_FREE_GB}GB free]"
  fi
}

# Always nag if they're low on mem...
echo_mem_warn
