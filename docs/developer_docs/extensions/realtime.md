---
title: Realtime
sidebar_position: 10
---

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

# Realtime

Superset can push a short "this entity changed" nudge to every signed-in browser, so that pages showing the entity fetch it again without polling. Extensions send it through `superset_core.realtime` on the backend and hear it through `realtime` in `@apache-superset/core` on the frontend, the namespace Superset's own list views listen through.

A nudge names the entity, as a type and an id, and nothing else. The page that hears it fetches the entity again through its own API, which decides what the viewer may see. That keeps every nudge safe to broadcast: it reaches every authenticated realtime connection of the deployment, whoever may read the entity.

## When nudges flow

Nudges travel over Superset's realtime transport: the `superset-websocket` server, a Redis coordination backend (`DISTRIBUTED_COORDINATION_CONFIG`), and `WEBSOCKET_ENABLE = True`. A deployment without them sends none, and the frontend events never fire.

Delivery is best-effort. A browser that is disconnected when a nudge is sent never receives it, and nothing is replayed. Design for that:

- Load what the page shows from your API, as without realtime, and treat a nudge only as a reason to load it again sooner.
- Load again on `onDidReconnect`, which fires after a dropped connection comes back.
- Where a page must stay current without realtime, as on a deployment that runs without the websocket server, keep a poll of its own.

## Relation to SIP-227

This API is the minimal extension-facing surface over Superset's realtime transport, and adds no transport of its own: `publish_entity_changed` sends the same `entity.changed` envelope as Superset's own publishers, on the same channel, and `onDidChangeEntity` and `onDidReconnect` listen on the page's one shared connection.

[SIP-227](https://github.com/apache/superset/issues/44174) proposes making that transport, the `superset-websocket` server over Redis/Valkey, required for every supported deployment. The shared frontend primitives it adds serve task status and catch-up, and it defines no entity-change event. Under SIP-227 this API keeps its contract, over a transport every supported deployment runs. Delivery stays best-effort: SIP-227 keeps initial reads and reconnect recovery on the REST APIs, as the guidance above does.

## Backend: publish a change

```python
from superset_core import realtime


def publish(widget) -> None:
    # ... commit the change first ...
    realtime.publish_entity_changed("widget", widget.uuid)
```

`publish_entity_changed(entity_type, entity_id)` takes:

- `entity_type`: the kind of entity, such as `"widget"`. Superset's own nudges use `"task"`; reuse a core type for a core entity your extension changes, so every page showing it hears the nudge.
- `entity_id`: its id, as pages know it: an integer, a string, or a UUID, which travels as its string.

It answers `True` once the nudge is sent, and `False` where the deployment has no realtime backend or the send failed; a failed send is logged, never raised. An empty type or an id of another type raises `ValueError`.

Call it after the change is committed. A page fetches as soon as it hears the nudge, and a fetch that runs before the commit reads the old state.

The nudge carries nothing but the type and the id. Never put a name, a value or a permission in the id: every signed-in browser of the deployment receives it.

## Frontend: listen for changes

```typescript
import { realtime } from '@apache-superset/core';

const changes = realtime.onDidChangeEntity(change => {
  if (change.entityType === 'widget' && change.id === widgetId) refetch();
});
const reconnects = realtime.onDidReconnect(refetch);

// When the page goes away:
changes.dispose();
reconnects.dispose();
```

- `onDidChangeEntity` fires for every nudge, of every type: filter for what the page shows. The first subscription connects the transport, where the deployment has it on.
- `onDidReconnect` fires when the connection comes back after a drop, when nudges may have been missed.

Several nudges often arrive together, such as one per step of a change. Debounce the fetch, as Superset's list views do (one second), so that a burst costs one request.

A host from before this API has no `realtime` namespace, and the import is `undefined` there. An extension that supports such hosts checks for it, and then relies on its own loads alone:

```typescript
import { realtime } from '@apache-superset/core';

const changes = realtime?.onDidChangeEntity(onChange);
```
