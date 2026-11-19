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

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
fixture_dir=$(mktemp -d "$script_dir/.frontend-mem-nag-test.XXXXXX")
trap 'rm -rf "$fixture_dir"' EXIT
mkdir -p "$fixture_dir/cgroup/memory"
meminfo_field=MemAvailable
passed=0

# Run the script with fixture values and check its output and successful exit.
check_memory() {
  local name="$1" host_kb="$2" limit="$3" usage="$4" expected_gb="$5" warning="$6"
  local output
  printf '%s: %s kB\n' "$meminfo_field" "$host_kb" > "$fixture_dir/meminfo"
  rm -f "$limit_file" "$usage_file"
  if [[ "$limit" != missing ]]; then
    printf '%s\n' "$limit" > "$limit_file"
  fi
  if [[ "$usage" != missing ]]; then
    printf '%s\n' "$usage" > "$usage_file"
  fi
  output=$(CODESPACES= MEM_TYPE=free LC_ALL=C \
    MEMINFO_FILE="$fixture_dir/meminfo" CGROUP_ROOT="$fixture_dir/cgroup" \
    bash "$script_dir/frontend-mem-nag.sh" 2>&1)

  if [[ "$warning" == yes ]]; then
    if [[ "$output" != *"Memory Insufficient Warning"* || "$output" != *"only have $expected_gb GB"* ]]; then
      printf 'FAIL: %s %s: expected a warning with %s GB, got:\n%s\n' "$version" "$name" "$expected_gb" "$output" >&2
      exit 1
    fi
  elif [[ "$output" != "Memory available: $expected_gb  GB" ]]; then
    printf 'FAIL: %s %s: expected sufficient memory (%s GB), got:\n%s\n' "$version" "$name" "$expected_gb" "$output" >&2
    exit 1
  fi
  printf 'PASS: %s %s\n' "$version" "$name"
  passed=$((passed + 1))
}

for version in v2 v1; do
  if [[ "$version" == v2 ]]; then
    limit_file="$fixture_dir/cgroup/memory.max"
    usage_file="$fixture_dir/cgroup/memory.current"
    unlimited=max
  else
    limit_file="$fixture_dir/cgroup/memory/memory.limit_in_bytes"
    usage_file="$fixture_dir/cgroup/memory/memory.usage_in_bytes"
    unlimited=9223372036854771712
  fi

  check_memory 'limit below minimum' 8388608 2147483648 536870912 1.5 yes
  check_memory 'sufficient remaining memory' 8388608 6442450944 1073741824 5 no
  check_memory 'usage reduces remaining memory' 8388608 8589934592 6442450944 2 yes
  check_memory 'host is lower' 1572864 8589934592 0 1.5 yes
  check_memory 'container is larger than host' 8388608 17179869184 0 8 no
  check_memory 'at existing threshold' 8388608 3072000000 0 2.86102 no
  check_memory 'below existing threshold' 8388608 3071998976 0 2.86102 yes
  check_memory 'limit exhausted' 8388608 2147483648 2147483648 0 yes
  check_memory 'usage exceeds limit' 8388608 2147483648 3221225472 0 yes
  check_memory 'unlimited' 8388608 "$unlimited" 536870912 8 no
  check_memory 'unlimited with low host memory' 1572864 "$unlimited" 536870912 1.5 yes
  check_memory 'missing usage' 8388608 2147483648 missing 8 no
  check_memory 'invalid usage' 8388608 2147483648 invalid 8 no
  check_memory 'invalid limit' 8388608 invalid 536870912 8 no
  check_memory 'no cgroup files' 8388608 missing missing 8 no
  check_memory 'no cgroup files with low host memory' 1572864 missing missing 1.5 yes
done

meminfo_field=MemFree
check_memory 'MemFree fallback' 1572864 missing missing 1.5 yes
check_memory 'MemFree with container limit' 8388608 2147483648 536870912 1.5 yes
printf 'Passed %s memory checks.\n' "$passed"
