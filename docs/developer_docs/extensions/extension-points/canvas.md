---
title: Canvas
sidebar_position: 6
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

# Canvas

A canvas places widgets: containers and text it stores itself, and saved widgets (rows of the `widgets` table) it references by UUID. An extension takes part in canvases by registering a widget type on the backend (`@widget` from `superset_core.widgets`) and its renderer on the frontend (`canvas.registerWidgetRenderer` from `@apache-superset/core`). Everything on this page sits behind the `CANVAS` feature flag, and only the import paths it names are supported.

## Canvas drafts

A canvas is changed in a draft: a private copy its owner, and their agent, build up and then publish (commit) or discard, with undo and redo on the server. A widget whose content lives outside the canvas, with a draft of its own that a canvas draft shows, follows the canvas draft through `superset_core.canvas.drafts` on the backend:

```python
from superset_core.canvas import drafts


@drafts.on_draft_event
def on_canvas_draft(event: drafts.CanvasDraftEvent) -> None:
    if event.kind == "discarded":
        discard_my_drafts(event.token)
```

- `on_draft_event(listener)` tells it what happened to a canvas draft, whichever way it was asked (the canvas page, the REST API or an agent's tool): `discarded`, `committed`, `undone` or `redone`. A draft that expires fires nothing. It returns the listener, so it works as a decorator.
- `record_step(token, DraftStep(kind=..., payload=..., widget_id=...), by="user")` adds a step of its own to the draft's history, so the canvas's undo and redo reach it like any other step: they call the handler registered for the kind with `register_step_handler(kind, handler)`, which returns the handler. Steps are recorded in the draft's history but never replayed on the canvas.
- Name a kind without a prefix, such as `edit`. In an extension's context, the host prefixes it with the extension's id, both where the handler is registered and where the step is recorded, as it prefixes an extension's MCP tools and REST APIs: the step is kept, handed to its handler and told to listeners as `extensions.<publisher>.<name>.edit`. There, a kind that already starts with `extensions.` is refused with `ValueError`. Outside any extension's context, a kind stays as named.

Listeners and step handlers run in the context of the extension that registered them, for the user the call runs for.

On the frontend, the canvas page tells extensions what it did to the draft it shows, each event with the draft's `canvasId` and `token`: `canvas.onDidPublishDraft` and `canvas.onDidDiscardDraft` fire after it published or discarded the draft, and `canvas.onDidUndoDraftStep` and `canvas.onDidRedoDraftStep` after it undid or redid a step, with `steppedWidgetIds`, the saved widgets whose content a recorded step moved, which their renderers fetch again. They fire only for what the page itself did: not for an edit, nor for what another tab, another REST client or an agent's tool did, which the backend's listeners hear of. `canvas.getActiveCanvas().draft` carries the open draft's `token` and `revision`: send the token only as the `X-Canvas-Draft` header, and never log it.
