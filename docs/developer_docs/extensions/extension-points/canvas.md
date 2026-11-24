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


def on_canvas_draft(event: drafts.CanvasDraftEvent) -> None:
    if event.kind == "discarded":
        discard_my_drafts(event.token)


drafts.on_draft_event(on_canvas_draft)
```

- `on_draft_event(listener)` tells it what happened to a canvas draft, whichever way it was asked (the canvas page, the REST API or an agent's tool): `discarded`, `committed`, `undone` or `redone`. A draft that expires fires nothing.
- `record_step(token, DraftStep(kind=..., payload=..., widget_id=...), by="user")` adds a step of its own to the draft's history, so the canvas's undo and redo reach it like any other step: they call the handler `register_step_handler(kind, handler)` registered for the kind. Name a kind after your extension, such as `extensions.acme.notes.edit`. Steps are recorded in the draft's history but never replayed on the canvas.
- `register_commit_participant(participant)` is asked before every commit, after the editor check and under the draft's lock, and can only refuse one: raise `CommitRefusedError(code, message)` to stop a commit that would publish the canvas without what has to go out with it.

Each of these runs in the context of the extension that registered it, for the user the call runs for.

On the frontend, `canvas.onDidChangeDraft` fires after the canvas page itself discarded, published, undid or redid the draft it shows; `steppedWidgetIds` names the saved widgets whose content a recorded step moved, which their renderers fetch again. `canvas.getActiveCanvas().draft` carries the open draft's `token` and `revision`: send the token only as the `X-Canvas-Draft` header, and never log it.

## Publish participants

`canvas.registerPublishParticipant({ prepare })` takes part in publishing a draft from the canvas page. When the person publishes, the page asks each participant's `prepare(draft)` what publishing it also publishes, and lists every part (`title`, `lines`) in a confirmation before anything is published. Once the person confirms, the page publishes each part (`publish()`) and then the canvas; the first part that fails stops the publish with its message, and publishing again from the confirmation publishes only the parts that didn't go out.

The publish is several requests, not one transaction: when parts went out and the canvas didn't, the confirmation says which. Only the page's publish asks participants. A commit that skips the page, such as an agent's through its tool, publishes no part, so pair a participant with a commit participant on the server that refuses the commit while a part waits.
