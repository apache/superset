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
WHEEL_DIR="${WHEEL_DIR:-/tmp}"
CPP_BUILD_DIR="$WORKDIR/arrow-cpp-build"
ARROW_ROOT="$WORKDIR/arrow"
ARROW_VERSION="${ARROW_VERSION:-0.16.0}"
PARALLEL_WORKERS="${PARALLEL_WORKERS:-$(nproc)}"
ARROW_PATCH_DIR="${ARROW_PATCH_DIR:-$SCRIPT_DIR}"
export ARROW_HOME="$WORKDIR/dist"
export LD_LIBRARY_PATH="$ARROW_HOME/lib:$LD_LIBRARY_PATH"
export CFLAGS="${CFLAGS:--Os -g0}"
export CXXFLAGS="${CXXFLAGS:--Os -g0}"
export LDFLAGS="${LDFLAGS:--s}"
export MAKEFLAGS="${MAKEFLAGS:--j$PARALLEL_WORKERS}"


# Install build tools
if [ "$NO_INSTALL_BUILD_TOOLS" != "true" ]; then
  apk_add_repos; toolchain_install; pip_upgrade
fi

# Clone Arrow Repo
if [ "$NO_GIT_CLONE" != "true" ]; then
  git clone \
      --branch "apache-arrow-$ARROW_VERSION" \
      https://github.com/apache/arrow.git "$ARROW_ROOT"
fi

# Patching
if [ -f "${ARROW_PATCH_DIR}/arrow-${ARROW_VERSION}-alpine.patch" ]; then
  echo -e "${GREEN}Patching arrow...${NC}"
  patch -d "$ARROW_ROOT" -s -p1 \
    < "${ARROW_PATCH_DIR}/arrow-${ARROW_VERSION}-alpine.patch"
fi

# Install dependencies from Arrow Repo
if [ "$NO_INSTALL_ARROW_REQUIREMENTS" != "true" ]; then
  echo -e "${GREEN}Pip installing arrow requirements...${NC}"
  pip install "numpy==${NUMPY_VERSION}"
  pip install \
      -r "$ARROW_ROOT/python/requirements-build.txt"
fi

# Install deps
if [ "$NO_INSTALL_FB_INFER" != "true" ]; then
  echo -e "${GREEN}Installing FB Infer...${NC}"
  FBINFER_VER=0.17.0
  curl -sSL \
    "https://github.com/facebook/infer/releases/download/v$FBINFER_VER/infer-linux64-v$FBINFER_VER.tar.xz" \
  | tar -C /opt -xJ
  ln -s "/opt/infer-linux64-v$FBINFER_VER/bin/infer" /usr/local/bin/infer
fi

# Build C++ library
echo -e "${GREEN}Building Arrow C++ library...${NC}"
mkdir -p "$CPP_BUILD_DIR"
cd "$CPP_BUILD_DIR"
cmake -GNinja \
      -DCMAKE_BUILD_TYPE=RELEASE \
      -DCMAKE_INSTALL_PREFIX="$ARROW_HOME" \
      -DCMAKE_INSTALL_LIBDIR=lib \
      -DARROW_CXXFLAGS="$CXXFLAGS" \
      -DARROW_WITH_BACKTRACE=ON \
      -DARROW_WITH_BZ2=ON \
      -DARROW_WITH_ZLIB=ON \
      -DARROW_WITH_ZSTD=ON \
      -DARROW_WITH_LZ4=ON \
      -DARROW_WITH_SNAPPY=ON \
      -DARROW_WITH_BROTLI=ON \
      -DARROW_PARQUET=ON \
      -DARROW_PYTHON=ON \
      -DARROW_FLIGHT=ON \
      -DARROW_PLASMA=ON \
      "$ARROW_ROOT/cpp"

ninja "-j$PARALLEL_WORKERS"; ninja install


# Enviroment vars setup
export PYARROW_PARALLEL=$PARALLEL_WORKERS
export PYARROW_BUILD_TYPE=release
export PYARROW_BUILD_VERBOSE=0
export PYARROW_CXXFLAGS="$CXXFLAGS"
export PYARROW_CMAKE_GENERATOR=Ninja
export PYARROW_WITH_PARQUET=1
export PYARROW_WITH_PLASMA=1
export PYARROW_WITH_FLIGHT=1
export SETUPTOOLS_SCM_PRETEND_VERSION="$ARROW_VERSION"

# Build Pyarrow
if [ "$NO_BUILD_PYARROW" != "true" ]; then
  echo -e "${GREEN}Building Pyarrow library...${NC}"
  cd "$ARROW_ROOT/python"
  rm -rf build/  # remove any pre-existing build directory
  python setup.py build_ext \
         --build-type="$PYARROW_BUILD_TYPE" \
         --bundle-arrow-cpp bdist_wheel

  # Copying Wheel
  echo -e "${GREEN}Moving wheel files into $WHEEL_DIR...${NC}"
  mkdir -p "$WHEEL_DIR"
  find "$WORKDIR/arrow/python/dist" \
    -name '*.whl' \
    -exec mv {} "$WHEEL_DIR"/ \;
fi
