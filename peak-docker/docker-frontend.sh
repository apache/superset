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

# cd /app/superset-frontend

# run superset in localhost
cd superset-frontend
npm install -f --no-optional --global webpack webpack-cli
npm install -f --no-optional

echo "Running frontend"
npm run dev-server --watch
# frontend : http://127.0.0.1:9000/login/?authToken=<Bearer Token>

# backend : http://127.0.0.1:8088/
# FLASK_ENV=development superset run -p 8088 --with-threads --reload --debugger
