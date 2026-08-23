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
# Configure via environment variables (see superset-websocket/src/config.ts for
# the full set), which must match the Flask app's WEBSOCKET_* config:
#   PORT, REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, REDIS_SSL,
#   JWT_SECRET (== WEBSOCKET_JWT_SECRET),
#   JWT_COOKIE_NAME (== WEBSOCKET_JWT_COOKIE_NAME, default superset-ws-token),
#   ALLOWED_ORIGINS.
set -e

exec node /app/superset-websocket/dist/index.js start
