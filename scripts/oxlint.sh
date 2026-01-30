#!/usr/bin/env bash

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

set -e

script_dir="$(dirname "$(realpath "$0")")"
root_dir="$(dirname "$script_dir")"
frontend_dir=superset-frontend

if [[ ! -d "$root_dir/$frontend_dir" ]]; then
  echo "Error: $frontend_dir directory not found in $root_dir" >&2
  exit 1
fi

cd "$root_dir/$frontend_dir"

# Filter files to only include JS/TS files and remove the frontend dir prefix
js_ts_files=()
for file in "$@"; do
  # Remove superset-frontend/ prefix if present
  cleaned_file="${file#$frontend_dir/}"

  # Only include JS/TS files
  if [[ "$cleaned_file" =~ \.(js|jsx|ts|tsx)$ ]]; then
    js_ts_files+=("$cleaned_file")
  fi
done

# Only run if we have JS/TS files to lint
if [ ${#js_ts_files[@]} -gt 0 ]; then
  # Skip custom OXC build in pre-commit for speed
  export SKIP_CUSTOM_OXC=true
  # Use quiet mode in pre-commit to reduce noise (only show errors)
  npx oxlint --config oxlint.json --fix --quiet "${js_ts_files[@]}"
else
  echo "No JavaScript/TypeScript files to lint"
fi
