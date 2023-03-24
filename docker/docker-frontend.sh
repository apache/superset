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

# Packages needed for puppeteer:
apt update
apt install -y chromium

export NODE_OPTIONS=--max_old_space_size=4096
mkdir -p /home/tmp_cache/
export npm_config_cache=/home/tmp_cache

cd /app/superset-frontend
npm install -f --no-optional --global webpack webpack-cli
npm install -f --no-optional

echo "Running liq viz plugins"

cd ./liq_viz_plugins/superset-plugin-chart-liq-thematic-maps
# Comment below before merging master for prod
# npm run dev & # Dev
# Uncomment below before merging master for prod
npm install --force
npm run build-only # Prod

rm -rf tmp_cache

cd ../../

echo "Running frontend"
npm run dev
