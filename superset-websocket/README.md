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
to the web frontend. It is a shared transport for authenticated realtime
sockets: it broadcasts opaque entity-change nudges and fans targeted task-status
events out to JWT-bound socket routing keys.

## Requirements

- Node.js 20.11+ to run the built bundle (the build targets `node20`, and
  `import.meta.dirname` requires 20.11). Building and developing this package
  follow the stricter `engines` range in `package.json`.
- Redis or Valkey, reachable for Pub/Sub

To use realtime push, enable it in the Superset backend (`WEBSOCKET_ENABLE`,
`WEBSOCKET_URL`, `WEBSOCKET_JWT_SECRET`; see below) and run this server on the
same browser-visible host.

## Architecture

### The `realtime` Pub/Sub channel and the message envelope

Realtime events are published to a single Redis **Pub/Sub** channel,
`<REALTIME_CHANNEL_PREFIX>realtime` (just `realtime` with the default empty
prefix), by the Superset Flask app (`superset/tasks/manager.py`). Pub/Sub is
intentionally best-effort (fire-and-forget, at-most-once — no replay): it
accelerates each feature's authoritative REST/poll path rather than guaranteeing
delivery, so a message missed during a disconnect is reconciled by a frontend
catch-up / REST refetch. See [Superset Configuration](#superset-configuration)
for the prefix and its Redis ACL implications.

Each Redis message is a self-describing envelope that separates **what** a message
is from **who** receives it:

```
{ topic, scope, routes?, payload }
```

- **`topic`** — the semantic stream the browser dispatches on: `task.status`,
  `entity.changed`, and future topics (`notification.*`, `report.progress`, …). A
  new surface adds a topic without inventing channel names or overloading payload
  shapes.
- **`scope`** — the delivery breadth the server routes by:
  - `authenticated_global` — broadcast to **every authenticated** realtime socket.
    This is authenticated-global, **not** public: anonymous users get no realtime
    principal, no JWT cookie, and therefore no socket, so they never receive these
    messages. (True anonymous/Public-role realtime would need a separate,
    restricted model and is out of scope.)
  - `principal` / `tab` — targeted to the routing keys in `routes`. The server
    treats the two the same way (deliver to `routes`); the distinction is only
    descriptive.
- **`routes`** — server-computed routing keys for a targeted scope: principal-grain
  `user:<id>` / `guest:<hmac>` (all of a principal's tabs), or per-tab
  `user:<id>:<tabId>` (one tab). Omitted for a broadcast. **Never forwarded to the
  browser.**
- **`payload`** — the feature-defined body forwarded verbatim to the browser.

The two topics in use:

1. **`entity.changed`** (`scope: authenticated_global`). An "an entity
   changed" broadcast whose payload carries only opaque ids
   (`{entity_type, id}`) — no status or sensitive data — so a list view can learn
   that an entity of a type it renders changed and re-fetch just the affected rows
   through the authorized API. Each client filters by `entity_type` and id.
2. **`task.status`** (`scope: principal` or `tab`). A targeted `{task_id, status}`
   message. It is published on a task's **terminal** completion (SUCCESS, FAILURE,
   ABORTED, TIMED_OUT), not on every intermediate transition — the chart-data
   client only needs to learn a task finished; intermediate progress for list
   views rides the `entity.changed` broadcast instead. Keys are principal-grain by
   default (reaching all of a principal's tabs) but a task type may narrow them to
   a per-tab channel (async chart-data does this), so only the tab watching a task
   is notified. A socket is bound to its per-tab channel only when the browser
   advertises a `tab_id` on the connect URL (see Connection); it is always also
   reachable on its principal channel.

The server forwards each browser message as `{topic, payload}` — the browser
dispatches on `topic` and never sees the route it arrived by. The server treats
each routing key as opaque; the producer is responsible for their correctness and
validates every policy-supplied key against the task's own subscriber principals
before publishing, so a key can never target another principal.

### Connection

When a user's browser connects, it does so over HTTP, including the JWT
authentication cookie set by the Flask app (`WEBSOCKET_JWT_COOKIE_NAME`, default
`superset-ws-token`). _Because authentication is cookie-based, the WebSocket
server must be served from the same browser-visible host as the web
application._ In Kubernetes this is expected to run cleanly as a separate
Deployment/Service behind an ingress that supports WebSocket upgrades. The
server verifies the JWT with the shared secret (`jwtSecret` / `JWT_SECRET`).
Superset mints the token only after the request principal has `can_read` on the
`Realtime` resource. The token carries `aud`, `iss`, `sub`, `principal_type`,
`channel`, and `exp`; the server rejects tokens whose channel does not match the
principal identity. The permission itself is not serialized into the token: a
valid token signed with the websocket secret is the proof that Superset already
authorized the transport.
The socket is bound to the `channel` claim (its principal channel), which is how
principal-grain task-status fanout selects recipient sockets. A principal may
have multiple sockets (e.g. several browser tabs); a message to the principal
channel is sent to all of them. When a browser also advertises a `tab_id` on the
connect URL (`wss://…/?tab_id=<id>`), its socket is additionally bound to a
per-tab channel (`<channel>:<tab_id>`, derived from the authorized principal
channel so it can never cross principals), letting the producer target one tab.
Because permission is checked when Superset mints the JWT and when the websocket
server accepts the upgrade, revocation after minting is bounded by the token
lifetime; the Superset default is 15 minutes. To keep a long-lived surface
connected without waiting for a hard disconnect at expiry, Superset re-mints the
cookie inside a sliding window (any request in the second half of the token's
life gets a fresh cookie), and the browser client proactively refreshes the
cookie and reconnects before expiry — so an active or idle-but-open realtime
surface stays connected while revocation remains bounded by the same lifetime.

During websocket JWT secret rotation, the websocket service can accept both the
current key (`jwtSecret` / `JWT_SECRET`) and one previous verify-only key
(`previousJwtSecret` / `PREVIOUS_JWT_SECRET`). The Flask app does not need the
previous key: it keeps minting new cookies with `WEBSOCKET_JWT_SECRET`, and any
cookie signed by the old key is replaced on the next HTTP response. Keep the
previous key configured on the websocket service until old cookies and open
sockets have aged out, then remove it.

The service is stateless apart from process-local live socket handles. Each
replica subscribes to the same Redis Pub/Sub channel, receives the same
events, and forwards only to matching sockets connected to that replica. Sticky
sessions are not required; reconnecting to another replica reuses the JWT cookie
and binds the socket to the same principal channel. Short websocket JWT
lifetimes keep connection lifetime bounded for pod recycling; if a pod is
terminated before expiry, connected browsers reconnect and a one-shot catch-up
fetch on reconnect reconciles any events missed while disconnected (chart-data
waiters re-check `/task/status_changes` from their retained cursor; list views
refetch their displayed rows). There is no recurring poll while the socket is
connected.

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

### Production hardening checklist

Because the websocket is now a shared realtime transport and ships in the main
image, review these before exposing it publicly:

- **`ALLOWED_ORIGINS`** — set it to your Superset origin(s) (see above). The
  default (empty) accepts any origin.
- **Secure, scoped JWT cookie** — on the Flask side set
  `WEBSOCKET_JWT_COOKIE_SECURE = True` (HTTPS only) and choose an explicit
  `WEBSOCKET_JWT_COOKIE_SAMESITE` (`"Lax"` when the app and websocket share a
  site; `"None"` only for cross-site, which then *requires* `Secure` and an
  `ALLOWED_ORIGINS` allowlist). Scope with `WEBSOCKET_JWT_COOKIE_DOMAIN` if
  needed. Cookies are short-lived and JWT-bound, but these flags close the
  cross-site surface.
- **Connection caps** — the server accepts unlimited connections by default
  (`0`). Set `maxTotalConnections` and `maxConnectionsPerChannel` (and
  optionally `maxSocketBufferBytes`) to bound resource use and blunt abuse.
- **Keepalive/timeouts** — `pingSocketsIntervalMs` / `socketResponseTimeoutMs`
  govern dead-connection reaping; the defaults are sane, tune per environment.

## Superset Configuration

Enable realtime push in the Superset Flask app (in `superset_config.py`):

```python
WEBSOCKET_ENABLE = True
WEBSOCKET_URL = "ws://<host>:<port>/"
WEBSOCKET_JWT_SECRET = "<a strong random secret, >= 32 bytes>"
```

The built-in `Gamma` role receives `can_read` on `Realtime`; grant that
permission to any additional roles that should receive websocket notifications.
Without that permission, Superset masks `WEBSOCKET_ENABLE` to `False` for the
request and does not mint the websocket JWT cookie.

Note that the WebSocket server must be run on the same hostname (different port)
for the JWT cookie to be shared between the Flask app and the WebSocket server.

Note also that `localhost` and `127.0.0.1` are not considered the same host. For
example, if you're pointing your browser to `localhost:<port>` for Superset,
then the WebSocket url will need to be configured as `localhost:<port>`.

The following values must be coordinated between the Flask app config and
this server's `config.json` (or its environment-variable overrides):

| Purpose                     | Flask app config            | WebSocket server config                     |
| --------------------------- | --------------------------- | ------------------------------------------- |
| Current signing/verify key  | `WEBSOCKET_JWT_SECRET`      | `jwtSecret` / `JWT_SECRET`                  |
| Previous verify-only key    | not needed                  | `previousJwtSecret` / `PREVIOUS_JWT_SECRET` |
| Cookie name                 | `WEBSOCKET_JWT_COOKIE_NAME` | `jwtCookieName` / `JWT_COOKIE_NAME`         |
| Realtime channel prefix     | `REALTIME_CHANNEL_PREFIX`   | `realtimeChannelPrefix` / `REALTIME_CHANNEL_PREFIX` |

The Redis connection (`redis` / `REDIS_*`) must point at the same Redis instance
Superset publishes to (`DISTRIBUTED_COORDINATION_CONFIG`). The channel the server
**subscribes** to is `<REALTIME_CHANNEL_PREFIX>realtime` — the prefix is empty by
default (channel `realtime`), and the resulting name is a wire-protocol contract
with the backend producer, so the prefix **must be set identically** on both
sides (`REALTIME_CHANNEL_PREFIX` in Superset and `REALTIME_CHANNEL_PREFIX` /
`realtimeChannelPrefix` here). The server forwards each envelope to browsers as
`{topic, payload}`. A Redis ACL for this server must therefore allow subscribing
to the **resulting** channel — `realtime` by default, or e.g. `tenant-a:realtime`
when `REALTIME_CHANNEL_PREFIX=tenant-a:`. Set a per-deployment prefix to keep
deployments that share one Redis/Valkey from cross-delivering realtime nudges
(Redis pub/sub is not scoped by DB number).

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
  -e PREVIOUS_JWT_SECRET="<old websocket JWT secret during rotation, optional>" \
  -e REDIS_HOST=<redis-host> \
  apache/superset:<tag> /app/docker/entrypoints/run-websocket.sh
```

Configure it with the same environment variables as the standalone server (see
`src/config.ts`); `JWT_SECRET` / `JWT_COOKIE_NAME` must match the Flask app's
`WEBSOCKET_JWT_SECRET` / `WEBSOCKET_JWT_COOKIE_NAME`,
`PREVIOUS_JWT_SECRET` can hold the prior websocket JWT secret during rotation,
and the Redis connection must point at the same instance as
`DISTRIBUTED_COORDINATION_CONFIG`.

With `docker compose`, start it via the opt-in `websocket` profile:

```bash
docker compose --profile websocket up superset-websocket
```

## Health check

The WebSocket server supports liveness checks via one of:

```text
GET /health
```

OR

```text
HEAD /health
```

`/health` is a pure liveness probe: it returns `200` whenever the process is up,
so a transient Redis blip does not churn pods.

For load-balancer draining, use the **readiness** endpoint instead:

```text
GET /ready
```

`/ready` returns `200` only while the server's Redis Pub/Sub subscriber is
connected and subscribed, and `503` when that subscriber has dropped (the server
can't deliver messages until it reconnects). Wire connection draining to `/ready`,
not `/health`, so a degraded pod stops receiving new connections while it recovers.

## Containerization

The server ships in the official Superset image (launched via
`/app/docker/entrypoints/run-websocket.sh`, see "Running" above). A standalone
`Dockerfile` is also provided in this directory for building the server on its
own during development.
