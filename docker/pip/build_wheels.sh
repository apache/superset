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
