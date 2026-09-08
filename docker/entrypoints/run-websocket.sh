#!/usr/bin/env bash
#
# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
#
# Launch the realtime WebSocket server (superset-websocket) bundled in the
# official image. Run it with:
#
#   docker run <superset-image> /app/docker/entrypoints/run-websocket.sh
#
# Configure via environment variables — see superset-websocket/src/config.ts for
# the authoritative, complete set (Redis connection, logging, connection limits,
# StatsD, etc.). The values that MUST match the Flask app's config are:
#   JWT_SECRET      == WEBSOCKET_JWT_SECRET
#   JWT_COOKIE_NAME == WEBSOCKET_JWT_COOKIE_NAME (default superset-ws-token)
#   REALTIME_CHANNEL_PREFIX == Flask REALTIME_CHANNEL_PREFIX (default empty; set a
#     per-deployment value on both sides to isolate a shared Redis/Valkey)
# Optional rotation setting:
#   PREVIOUS_JWT_SECRET == old WEBSOCKET_JWT_SECRET accepted for verification
# and the Redis connection (REDIS_HOST/REDIS_PORT/...) must point at the same
# instance as the app's DISTRIBUTED_COORDINATION_CONFIG.
set -e

# Run from a writable directory so that opting into file logging with the
# default relative LOG_FILENAME (LOG_TO_FILE=true) writes somewhere the
# unprivileged `superset` user can create files, rather than the read-only /app.
# The config.json lookup is unaffected (it resolves relative to the bundle).
cd "${SUPERSET_HOME:-/app/superset_home}"

exec node /app/superset-websocket/dist/index.cjs start
