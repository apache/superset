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

A Node.js WebSocket server that pushes realtime events from the Superset backend
to the web frontend. It is a **generic, feature-agnostic transport**: it routes
messages by Redis channel name and never interprets their contents, so any
Superset feature (async chart data, background tasks, and future producers such
as thumbnails, reports, or exports) can push over it without a server change.

## Requirements

- Node.js 12+ (not tested with older versions)
- Redis 5+

To use realtime push, enable it in the Superset backend (`WEBSOCKET_ENABLED`,
`WEBSOCKET_URL`, `WEBSOCKET_JWT_SECRET`; see below) and run this server on the
same host.

## Architecture

### Redis Pub/Sub channels and the two tiers

Realtime events are published to Redis **Pub/Sub** by the Superset Flask app
(`superset/tasks/manager.py`). Pub/Sub is intentionally lossy (fire-and-forget):
a missed message must be reconciled by a frontend poll or REST refetch. Broad
broadcast messages therefore carry only nudges; per-principal messages may carry
feature-specific state only when the producer derives the target channel from
principals authorized to receive it.

The server tails two channel-prefix patterns and routes by name only:

1. **Tier 1 — authenticated entity-change nudges** (`entity-changes:<type>`,
   e.g. `entity-changes:task`). Broadcast to every connected realtime socket.
   The payload carries only opaque ids (`{entity_type, id}`) — no status or
   sensitive data — so a list view can learn "an entity of this type changed"
   and re-fetch just the affected rows through the authorized API. Each client
   filters to the ids it renders.
2. **Tier 2 — per-principal messages** (`realtime:<channel_id>`, where
   `channel_id` is `user:<id>` or `guest-<hmac>`). Delivered **only** to sockets
   whose JWT bound that principal channel. Because delivery is scoped to a
   principal already entitled to see the entity, the payload may carry
   feature-specific detail (e.g. a task's `{task_id, status}`).

The server forwards each message to the browser in a generic envelope
`{ channel, payload }` (the full Redis channel name plus the parsed payload), so
the client routes on `channel` exactly as the server does.

### Connection

When a user's browser connects, it does so over HTTP, including the JWT
authentication cookie set by the Flask app (`WEBSOCKET_JWT_COOKIE_NAME`, default
`superset-ws-token`). _Because authentication is cookie-based, the WebSocket
server must run on the same host as the web application._ The server verifies
the JWT with the shared secret (`jwtSecret` / `WEBSOCKET_JWT_SECRET`).
Superset mints the token only after the request principal has `can_read` on the
`Realtime` resource. The token carries `aud`, `iss`, `sub`, `principal_type`,
`permissions`, `channel`, and `exp`; the server rejects tokens whose realtime
permission is missing or whose channel does not match the principal identity.
The socket is then bound to the `channel` claim, which is how tier-2 messages are
routed to it. A principal may have multiple sockets (e.g. several browser tabs);
all matching messages are sent to all of them.

### Connection Management

The server uses standard WebSocket
[ping/pong](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API/Writing_WebSocket_servers#pings_and_pongs_the_heartbeat_of_websockets)
to detect dead connections. Active sockets are pinged regularly (config:
`pingSocketsIntervalMs`) and the internal registry records the last _pong_
timestamp; a socket that has not responded within `socketResponseTimeoutMs` is
terminated. Sockets are also terminated after the JWT `exp` time passes. The
channel registry is periodically cleaned
(`gcChannelsIntervalMs`) to release stale references.

## Install

Install dependencies:

```bash
npm ci
```

## WebSocket Server Configuration

Copy `config.example.json` to `config.json` and adjust the values for your environment.

Configuration via environment variables is also supported which can be helpful in certain contexts, e.g., deployment. `src/config.ts` can be consulted to see the full list of supported values.

### Restricting WebSocket origins

To mitigate Cross-Site WebSocket Hijacking, set `allowedOrigins` (or the
`ALLOWED_ORIGINS` environment variable, comma-separated) to the list of origins
permitted to open WebSocket connections, e.g. the origin Superset is served
from:

```json
{
  "allowedOrigins": ["https://superset.example.com"]
}
```

The `Origin` header of each upgrade request must exactly match one of the
configured values. When `allowedOrigins` is empty (the default) the check is
skipped and any origin is accepted; a single `"*"` entry explicitly allows any
origin. Setting this is recommended for production deployments, especially when
the JWT cookie uses `SameSite=None`.

## Superset Configuration

Enable realtime push in the Superset Flask app (in `superset_config.py`):

```python
WEBSOCKET_ENABLED = True
WEBSOCKET_URL = "ws://<host>:<port>/"
WEBSOCKET_JWT_SECRET = "<a strong random secret, >= 32 bytes>"
```

Grant `can_read` on `Realtime` to roles that should receive websocket
notifications. Without that permission, Superset masks `WEBSOCKET_ENABLED` to
`False` for the request and does not mint the websocket JWT cookie.

Note that the WebSocket server must be run on the same hostname (different port)
for the JWT cookie to be shared between the Flask app and the WebSocket server.

Note also that `localhost` and `127.0.0.1` are not considered the same host. For
example, if you're pointing your browser to `localhost:<port>` for Superset,
then the WebSocket url will need to be configured as `localhost:<port>`.

The following values must match between the Flask app config and this server's
`config.json` (or its environment-variable overrides):

| Flask app config              | WebSocket server config       |
| ----------------------------- | ----------------------------- |
| `WEBSOCKET_JWT_SECRET`        | `jwtSecret` / `JWT_SECRET`    |
| `WEBSOCKET_JWT_COOKIE_NAME`   | `jwtCookieName` / `JWT_COOKIE_NAME` |

The Redis connection (`redis` / `REDIS_*`) must point at the same Redis instance
Superset publishes to (`DISTRIBUTED_COORDINATION_CONFIG`). The Pub/Sub channel
prefixes (`entity-changes:`, `realtime:`) are a fixed wire-protocol contract with
the backend producer and are not configurable.

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

```bash
npm run dev-server
```

Running in production:

```bash
npm run build && npm start
```

### From the official Superset image (recommended)

The WebSocket server is bundled in the official Superset image and launched via
an alternate entrypoint, so no separate image is required:

```bash
docker run --rm -p 8080:8080 \
  -e JWT_SECRET="<same value as the app's WEBSOCKET_JWT_SECRET, >= 32 bytes>" \
  -e REDIS_HOST=<redis-host> \
  apache/superset:<tag> /app/docker/entrypoints/run-websocket.sh
```

Configure it with the same environment variables as the standalone server (see
`src/config.ts`); `JWT_SECRET` / `JWT_COOKIE_NAME` must match the Flask app's
`WEBSOCKET_JWT_SECRET` / `WEBSOCKET_JWT_COOKIE_NAME`, and the Redis connection
must point at the same instance as `DISTRIBUTED_COORDINATION_CONFIG`.

With `docker compose`, start it via the opt-in `websocket` profile:

```bash
docker compose --profile websocket up superset-websocket
```

## Health check

The WebSocket server supports health checks via one of:

```text
GET /health
```

OR

```text
HEAD /health
```

## Containerization

The server ships in the official Superset image (launched via
`/app/docker/entrypoints/run-websocket.sh`, see "Running" above). A standalone
`Dockerfile` is also provided in this directory for building the server on its
own during development.
