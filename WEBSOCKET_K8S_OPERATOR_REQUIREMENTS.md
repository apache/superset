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

# WebSocket Kubernetes Operator Requirements

This note captures the expected Kubernetes deployment model for the
`superset-websocket` realtime transport used by the GAQ-to-GTF migration.

## Runtime Model

Run `superset-websocket` as an independent Deployment and Service. It should not
be modeled as a singleton, and it does not need to run as a sidecar in the
Superset web pod.

The service is stateless from the deployment perspective. Each replica owns only
its local live WebSocket connections. There is no shared in-memory socket
registry and no requirement for sticky sessions.

Each browser WebSocket is a single upgraded HTTP connection. The ingress or load
balancer chooses one websocket replica during the initial HTTP Upgrade, and all
frames for that socket stay on that replica until the socket closes. If the
browser reconnects, a new replica may be selected.

## Routing Model

Superset publishes one Redis Pub/Sub event for a realtime update. Every
websocket replica subscribes to the same Pub/Sub channels and receives the same
event.

Each replica then performs local fanout only:

1. Derive the target principal channel from the event's `subscribers`.
2. Check the replica-local socket registry.
3. Send the browser message only to matching sockets connected to that replica.
4. Do nothing if the replica has no matching local sockets.

This avoids producer-side routing to a specific replica. A singleton or Redis
Stream consumer group would be the wrong shape for this fanout path because the
selected consumer might not own the target socket. If event volume later makes
"every replica receives every event" too expensive, the next architecture should
be replica-specific routing backed by a shared connection directory.

## Ingress Requirements

The ingress must support WebSocket upgrades and long-lived upgraded
connections. It should route the websocket endpoint on the same browser-visible
host as the Superset web app so the HTTP-only websocket JWT cookie is sent with
the upgrade request.

For example, if Superset is served from:

```text
https://superset.example.com/
```

then `WEBSOCKET_URL` should use the same host:

```python
WEBSOCKET_URL = "wss://superset.example.com/<websocket-path>"
```

The websocket service should configure `ALLOWED_ORIGINS` to the Superset origin,
for example:

```text
ALLOWED_ORIGINS=https://superset.example.com
```

## Auth Configuration

Superset Flask app config:

```python
WEBSOCKET_ENABLE = True
WEBSOCKET_URL = "wss://superset.example.com/<websocket-path>"
WEBSOCKET_JWT_SECRET = "<current strong secret, >= 32 bytes>"
WEBSOCKET_JWT_COOKIE_SECURE = True
```

The built-in Gamma role receives `can_read Realtime`; custom roles that should
receive realtime notifications also need that permission. Superset mints the
websocket JWT cookie only after this permission check passes.

`superset-websocket` service config:

```text
JWT_SECRET=<same value as WEBSOCKET_JWT_SECRET>
JWT_COOKIE_NAME=superset-ws-token
PREVIOUS_JWT_SECRET=<old websocket JWT secret during rotation, optional>
```

The previous key is configured only on `superset-websocket`. The Flask app does
not need it because Flask only mints new cookies with the current
`WEBSOCKET_JWT_SECRET`. If Flask sees an old-key cookie on a later HTTP request,
it treats it as stale and replaces it with a current-key cookie.

## Secret Rotation

Use a two-key overlap on the websocket service:

1. Start with Flask and `superset-websocket` using the old key.
2. Deploy `superset-websocket` with `JWT_SECRET=<new-key>` and
   `PREVIOUS_JWT_SECRET=<old-key>`.
3. Deploy Flask with `WEBSOCKET_JWT_SECRET=<new-key>`.
4. Wait longer than `WEBSOCKET_JWT_EXPIRATION_SECONDS`, plus rollout and clock
   skew margin.
5. Remove `PREVIOUS_JWT_SECRET` from `superset-websocket`.

This order avoids rejecting old cookies before Flask starts minting new ones.

## Connection Lifetime And Draining

WebSocket connections should be short-lived enough that pod recycling does not
wait on long-lived sockets indefinitely. The current design bounds socket
lifetime with the JWT expiration. The default Superset value is 15 minutes:

```python
WEBSOCKET_JWT_EXPIRATION_SECONDS = 900
```

Operators may lower this value for faster natural churn. The tradeoff is more
browser reconnects and more JWT cookie minting.

For pod termination, the operator should prefer the normal Kubernetes drain
shape:

1. Mark the pod unready so no new WebSocket upgrades are routed to it.
2. Allow a short drain window if configured.
3. Terminate remaining sockets; browsers reconnect to another replica.

The realtime transport is lossy by design. Missed messages during reconnect or
pod termination are reconciled by the frontend's polling fallback.

## Redis Requirements

`superset-websocket` must connect to the same Redis instance that Superset uses
for `DISTRIBUTED_COORDINATION_CONFIG`.

The websocket fanout path uses Redis Pub/Sub, not Redis Streams. Pub/Sub is
acceptable here because realtime messages accelerate UI updates but do not carry
correctness: every consuming feature still re-fetches or polls through
authorized Superset APIs.

## Scaling Notes

Horizontal scaling is safe because replicas do not share mutable process state.
HPA can scale the Deployment based on CPU, memory, ingress connection metrics,
or future websocket-specific metrics.

The main scaling cost is Pub/Sub broadcast amplification: every replica receives
every realtime event. That is intentional for the first architecture because it
keeps the websocket service stateless and avoids a distributed connection
directory. If this becomes too expensive, introduce replica-specific routing as
a separate design.
