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

# Pre-commit hook for checking Apache license headers in changed files only
# This is much faster than running the full RAT check on the entire repository

set -e

# Files to check are passed as arguments
FILES="$@"

if [ -z "$FILES" ]; then
  exit 0
fi

# License header patterns to look for
ASF_HEADER_PATTERNS=(
  "Licensed to the Apache Software Foundation"
  "Licensed under the Apache License"
)

# Check each file
MISSING_HEADERS=""
for file in $FILES; do
  # Skip files that are in .rat-excludes patterns
  # Check common excluded patterns
  if [[ "$file" == *.json ]] || \
     [[ "$file" == *.md ]] || \
     [[ "$file" == *.yml ]] || \
     [[ "$file" == *.yaml ]] || \
     [[ "$file" == *.csv ]] || \
     [[ "$file" == *.txt ]] || \
     [[ "$file" == *.lock ]] || \
     [[ "$file" == */node_modules/* ]] || \
     [[ "$file" == */.next/* ]] || \
     [[ "$file" == */build/* ]] || \
     [[ "$file" == */dist/* ]] || \
     [[ "$file" == *.min.js ]] || \
     [[ "$file" == *.min.css ]]; then
    continue
  fi

  # Check if file exists (might be deleted)
  if [ ! -f "$file" ]; then
    continue
  fi

  # Check for license header in first 20 lines
  has_header=false
  for pattern in "${ASF_HEADER_PATTERNS[@]}"; do
    if head -20 "$file" | grep -q "$pattern"; then
      has_header=true
      break
    fi
  done

  if [ "$has_header" = false ]; then
    MISSING_HEADERS="$MISSING_HEADERS\n  $file"
  fi
done

if [ -n "$MISSING_HEADERS" ]; then
  echo "❌ Apache license headers missing in the following files:"
  echo -e "$MISSING_HEADERS"
  echo ""
  echo "Please add the Apache license header to these files."
  echo "See existing files for examples."
  exit 1
fi

echo "✅ License headers check passed"
exit 0
