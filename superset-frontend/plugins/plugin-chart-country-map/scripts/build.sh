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

# Country Map build pipeline.
#
# One-shot, reproducible: pinned upstream NE version, deterministic outputs.
# Replaces the legacy Jupyter notebook. See README.md for details.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Sanity checks
command -v python3 >/dev/null || { echo "python3 required" >&2; exit 1; }
command -v npx     >/dev/null || { echo "npx (Node.js) required for mapshaper" >&2; exit 1; }

python3 -c "import yaml" 2>/dev/null || {
  echo "PyYAML required: pip install pyyaml" >&2
  exit 1
}

exec python3 build.py "$@"
