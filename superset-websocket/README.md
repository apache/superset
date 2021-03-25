<!--
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
-->
# Superset WebSocket Server

A Node.js WebSocket server for sending async event data to the Superset web application frontend, based on [SIP-39](https://github.com/apache/superset/issues/9190).

## Requirements

- Node.js 12+ (not tested with older versions)
- Redis 5+

To use this feature, Superset needs to be configured to enable global async queries and to use WebSockets as the transport (see below).

## Install

Install dependencies:
```
npm install
```

## WebSocket Server Configuration

Copy `config.example.json` to `config.json` and adjust the values for your environment.

## Superset configuration

Configure the Superset Flask app to enable global async queries (in `superset_config.py`):

Enable the `GLOBAL_ASYNC_QUERIES` feature flag:
```
"GLOBAL_ASYNC_QUERIES": True
```

Configure the following Superset values:
```
GLOBAL_ASYNC_QUERIES_TRANSPORT = "ws"
GLOBAL_ASYNC_QUERIES_WEBSOCKET_URL = "ws://<host>:<port>/"
```

Note that the WebSocket server must be run on the same hostname (different port) for cookies to be shared between the Flask app and the WebSocket server.

The following config values must contain the same values in both the Flask app config and `config.json`:
```
GLOBAL_ASYNC_QUERIES_REDIS_CONFIG
GLOBAL_ASYNC_QUERIES_REDIS_STREAM_PREFIX
GLOBAL_ASYNC_QUERIES_JWT_COOKIE_NAME
GLOBAL_ASYNC_QUERIES_JWT_SECRET
```

More info on Superset configuration values for async queries: https://github.com/apache/superset/blob/master/CONTRIBUTING.md#async-chart-queries

## Running

Running locally via dev server:
```
npm run dev-server
```

Running remotely:
```
npm run build && npm start
```

*TODO: containerization*
