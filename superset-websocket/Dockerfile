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
FROM node:24-alpine AS build

# Harden `npm ci` against transient npm-registry network blips (e.g. ECONNRESET),
# which otherwise fail the image build with no retry.
ENV npm_config_fetch_retries=5 \
    npm_config_fetch_retry_mintimeout=20000 \
    npm_config_fetch_retry_maxtimeout=120000 \
    npm_config_fetch_timeout=600000

WORKDIR /home/superset-websocket

COPY . ./

RUN npm ci && \
  npm run build


FROM node:24-alpine

# Retry npm-registry fetches so a transient blip doesn't fail the build.
ENV NODE_ENV=production \
    npm_config_fetch_retries=5 \
    npm_config_fetch_retry_mintimeout=20000 \
    npm_config_fetch_retry_maxtimeout=120000 \
    npm_config_fetch_timeout=600000
WORKDIR /home/superset-websocket

COPY --from=build /home/superset-websocket/dist ./dist
COPY package*.json ./

# Only install production dependencies
RUN npm ci --omit=dev

# Don't run as root!
USER node

CMD [ "npm", "start" ]
