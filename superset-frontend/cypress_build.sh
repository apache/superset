#!/bin/bash
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

cd "$(dirname "$0")"

#run all the python steps in a background process
time superset db upgrade
time superset load_test_users
time superset load_examples --load-test-data
time superset init
echo "[completed python build steps]"
flask run -p 8081 --with-threads --reload --debugger &

#block on the longer running javascript process
time npm ci
time npm run build
echo "[completed js build steps]"

#setup cypress
cd cypress-base
time npm ci
CYPRESS_PATH='cypress/integration/'${1}'/*'
time npm run cypress run -- --spec "$CYPRESS_PATH" --record false --config video=false

kill %1
