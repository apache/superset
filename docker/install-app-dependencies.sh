#!/usr/bin/env bash
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
        --no-sources --no-editable "${SOURCE_ROOT}/superset-core" "${SOURCE_ROOT}"
else
    /app/docker/pip-install.sh --requires-build-essential -r requirements/base.txt
fi