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

pip_upgrade() {
  pip3 install \
    --no-cache-dir \
    --upgrade pip setuptools wheel cython
}

lineinfile() {
  if [ $# -ne 3 ]; then
    local THIS_FUNC_NAME="${funcstack[1]-}${FUNCNAME[0]-}"
    echo "$THIS_FUNC_NAME - 3 arguments are expected. given $#. args=[$*]" >&2
    echo "usage: $THIS_FUNC_NAME PATTERN LINE FILE" >&2
    return 1
  fi
  local PATTERN="${1//\//\\/}" #sed-escaping of slash char
  local LINE="${2//\//\\/}"
  local FILE="$3"
  # Sed solution on https://stackoverflow.com/a/29060802
  if ! sed -i "/$PATTERN/{s//$LINE/;h};"'${x;/./{x;q0};x;q1}' "$FILE" ;then
    echo "$2" >> "$3"
  fi
}

apk_add_repos() {
  local FILE='/etc/apk/repositories'
  # append lines
  lineinfile '^@edge_main .*$' '@edge_main http://dl-cdn.alpinelinux.org/alpine/edge/main' "$FILE"
  lineinfile '^@edge_comm .*$' '@edge_main http://dl-cdn.alpinelinux.org/alpine/edge/community' "$FILE"
  lineinfile '^@edge_test .*$' '@edge_main http://dl-cdn.alpinelinux.org/alpine/edge/testing' "$FILE"
}

toolchain_install() {
  # Install build tools
  apk add --no-cache --update \
    g++ git unzip cmake make linux-headers \
    flex bison \
    curl \
    ninja \
    patch \
    pkgconf \
    cyrus-sasl-dev \
    libexecinfo-dev \
    libaio-dev \
    libffi-dev \
    openldap-dev \
    openssl-dev \
    mariadb-connector-c-dev \
    freetds-dev \
    postgresql-dev
}
