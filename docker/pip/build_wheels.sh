#!/bin/bash

set -e


SCRIPT_DIR="$(dirname "$(readlink -f "$0")")"
source "$SCRIPT_DIR"/libsetup.sh
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Settings
_WORKDIR="${1:-$WORKDIR}"
WORKDIR="${_WORKDIR:-$HOME}"
REQUIREMENTS_TXT=${REQUIREMENTS_TXT:-$WORKDIR/requirements.txt}
PARALLEL_WORKERS="${PARALLEL_WORKERS:-$(nproc)}"
export WHEEL_DIR=${WHEEL_DIR:-/tmp}
export CFLAGS="${CFLAGS:--Os -g0}"
export CXXFLAGS="${CXXFLAGS:--Os -g0}"
export LDFLAGS="${LDFLAGS:--s}"
export MAKEFLAGS="${MAKEFLAGS:--j$PARALLEL_WORKERS}"


# Install build tools
if [ "$NO_INSTALL_BUILD_TOOLS" != "true" ]; then
  apk_add_repos; toolchain_install; pip_upgrade
fi

# Build wheels
echo -e "${GREEN}Building wheels for $REQUIREMENTS_TXT into $WHEEL_DIR...${NC}"
ln -sf /usr/include/locale.h /usr/include/xlocale.h
pip3 wheel \
     --find-links="$WHEEL_DIR" \
     -w "$WHEEL_DIR" \
     -r "$REQUIREMENTS_TXT"

