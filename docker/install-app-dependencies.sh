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
set -euo pipefail

SOURCE_ROOT="${1:?Application source root is required}"

if python -c 'import sys; raise SystemExit(sys.version_info < (3, 15))'; then
    if [[ -d "${SOURCE_ROOT}" && ! -w "${SOURCE_ROOT}" ]]; then
        BUILD_ROOT="$(mktemp -d)"
        trap 'rm -rf "${BUILD_ROOT}"' EXIT
        cp -a "${SOURCE_ROOT}/." "${BUILD_ROOT}/"
        SOURCE_ROOT="${BUILD_ROOT}"
    fi
    /app/docker/pip-install.sh --requires-build-essential \
        --no-sources "${SOURCE_ROOT}/superset-core" "${SOURCE_ROOT}"
else
    /app/docker/pip-install.sh --requires-build-essential -r requirements/base.txt
fi
