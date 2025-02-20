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
npm run eslint -- "${@//$frontend_dir\//}"
