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

A Node.js WebSocket server for sending async event data to the Superset web application frontend.

## Requirements

- Node.js 12+ (not tested with older versions)
- Redis 5+

To use this feature, Superset needs to be configured to enable global async queries and to use WebSockets as the transport (see below).

## Architecture

This implementation is based on the architecture defined in [SIP-39](https://github.com/apache/superset/issues/9190).

### Streams

Async events are pushed to [Redis Streams](https://redis.io/topics/streams-intro) from the [Superset Flask app](https://github.com/preset-io/superset/blob/master/superset/utils/async_query_manager.py). An event for a particular user is published to two streams: 1) the global event stream that includes events for all users, and 2) a channel/session-specific stream only for the user. This approach provides a good balance of performance (reading off of a single global stream) and fault tolerance (dropped connections can "catch up" by reading from the channel-specific stream).

Note that Redis Stream [consumer groups](https://redis.io/topics/streams-intro#consumer-groups) are not used here due to the fact that each group receives a subset of the data for a stream, and WebSocket clients have a persistent connection to each app instance, requiring access to all data in a stream. Horizontal scaling of the WebSocket app requires having multiple WebSocket servers, each with full access to the Redis Stream data.

### Connection

When a user's browser initially connects to the WebSocket server, it does so over HTTP, which includes the JWT authentication cookie, set by the Flask app, in the request. _Note that due to the cookie-based authentication method, the WebSocket server must be run on the same host as the web application._ The server validates the JWT token by using the shared secret (config: `jwtSecret`), and if valid, proceeds to upgrade the connection to a WebSocket. The user's session-based "channel" ID is contained in the JWT, and serves as the basis for sending received events to the user's connected socket(s).

A user may have multiple WebSocket connections under a single channel (session) ID. This would be the case if the user has multiple browser tabs open, for example. In this scenario, **all events received for a specific channel are sent to all connected sockets**, leaving it to the consumer to decide which events are relevant to the current application context.

### Reconnection

It is expected that a user's WebSocket connection may be dropped or interrupted due to fluctuating network conditions. The Superset frontend code keeps track of the last received async event ID, and attempts to reconnect to the WebSocket server with a `last_id` query parameter in the initial HTTP request. If a connection includes a valid `last_id` value, events that may have already been received and sent unsuccessfully are read from the channel-based Redis Stream and re-sent to the new WebSocket connection. The global event stream flow then assumes responsibility for sending subsequent events to the connected socket(s).

### Connection Management

The server utilizes the standard WebSocket [ping/pong functionality](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API/Writing_WebSocket_servers#pings_and_pongs_the_heartbeat_of_websockets) to determine if active WebSocket connections are still alive. Active sockets are sent a _ping_ regularly (config: `pingSocketsIntervalMs`), and the internal _sockets_ registry is updated with a timestamp when a _pong_ response is received. If a _pong_ response has not been received before the timeout period (config: `socketResponseTimeoutMs`), the socket is terminated and removed from the internal registry.

In addition to periodic socket connection cleanup, the internal _channels_ registry is regularly "cleaned" (config: `gcChannelsIntervalMs`) to remove stale references and prevent excessive memory consumption over time.

## Install

Install dependencies:
```
npm install
```

## WebSocket Server Configuration

Copy `config.example.json` to `config.json` and adjust the values for your environment.

Configuration via environment variables is also supported which can be helpful in certain contexts, e.g., deployment. `src/config.ts` can be consulted to see the full list of supported values.

## Superset Configuration

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

Note also that `localhost` and `127.0.0.1` are not considered the same host. For example, if you're pointing your browser to `localhost:<port>` for Superset, then the WebSocket url will need to be configured as `localhost:<port>`.

The following config values must contain the same values in both the Flask app config and `config.json`:
```
GLOBAL_ASYNC_QUERIES_REDIS_CONFIG
GLOBAL_ASYNC_QUERIES_REDIS_STREAM_PREFIX
GLOBAL_ASYNC_QUERIES_JWT_COOKIE_NAME
GLOBAL_ASYNC_QUERIES_JWT_SECRET
```

More info on Superset configuration values for async queries: https://github.com/apache/superset/blob/master/CONTRIBUTING.md#async-chart-queries

## StatsD monitoring

The application is tracking a couple of metrics with `statsd` using the [hot-shots](https://www.npmjs.com/package/hot-shots) library, such as the number of connected clients and the number of failed attempts to send a message to a client.

`statsd` can be configured with the `statsd` object in the configuration file. See the [hot-shots](https://www.npmjs.com/package/hot-shots) readme for more info. The default configuration is:

```json
{
  "statsd": {
    "host": "127.0.0.1",
    "port": 8125,
    "globalTags": []
  }
}
```

## Running

Running locally via dev server:
```
npm run dev-server
```

Running in production:
```
npm run build && npm start
```

## Health check

The WebSocket server supports health checks via one of:

```
GET /health
```

OR

```
HEAD /health
```

## Containerization

*TODO: containerize websocket server*
