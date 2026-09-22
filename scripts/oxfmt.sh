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

# Format the passed files with oxfmt, from within an npm workspace.
#
# Usage: scripts/oxfmt.sh <workspace-dir> [file...]
#
# Paths are passed in repo-relative (as pre-commit provides them) and rewritten
# relative to the workspace, since oxfmt resolves its config from the working
# directory.

set -e

workspace_dir="$1"
shift

if [[ -z "$workspace_dir" ]]; then
  echo "Error: no workspace directory given" >&2
  exit 1
fi

script_dir="$(dirname "$(realpath "$0")")"
root_dir="$(dirname "$script_dir")"

if [[ ! -d "$root_dir/$workspace_dir" ]]; then
  echo "Error: $workspace_dir directory not found in $root_dir" >&2
  exit 1
fi

cd "$root_dir/$workspace_dir"

files=()
for file in "$@"; do
  files+=("${file#$workspace_dir/}")
done

if [ ${#files[@]} -eq 0 ]; then
  echo "No files to format"
  exit 0
fi

npx oxfmt --write --no-error-on-unmatched-pattern -- "${files[@]}"
