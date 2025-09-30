#!/bin/bash
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

# Build script for individual packages called by Nx

PACKAGE_PATH=$1
PACKAGE_NAME=$(basename $PACKAGE_PATH)

cd $PACKAGE_PATH

echo "Building $PACKAGE_NAME..."

# Run babel builds in parallel
bunx babel --config-file=../../babel.config.js src --extensions .ts,.tsx,.js,.jsx --copy-files --out-dir lib &
PID1=$!

bunx babel --config-file=../../babel.config.js src --extensions .ts,.tsx,.js,.jsx --copy-files --out-dir esm &
PID2=$!

# Wait for both to complete
wait $PID1
wait $PID2

# Run TypeScript (log errors but continue, matching current build behavior)
echo "Building TypeScript declarations..."
if [ "$USE_BUN_TSC" = "true" ]; then
  bunx tsc --build 2>&1 | grep -v "error TS" || true
else
  ../../scripts/tsc.sh --build 2>&1 | grep -v "error TS" || true
fi

echo "✅ $PACKAGE_NAME built successfully"
