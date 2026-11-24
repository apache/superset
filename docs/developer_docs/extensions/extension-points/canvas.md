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

## Widget data

A widget's data is always queried on the server, from what is stored: the caller only adds runtime filters, the values of the canvas filters and cross-filters that reach the widget, which narrow the binding's own dataset. Each query runs as the caller, through the chart data pipeline, so dataset access, row level security and caching apply as for any chart.

| Endpoint | Reads | Access |
| --- | --- | --- |
| `POST /api/v1/canvas/<id_or_uuid>/placement/<placement_id>/data` | A placement, from the stored canvas, the caller's draft of it (`X-Canvas-Draft`), or one of its versions (`X-Canvas-Version`) | The canvas, and the binding's dataset |
| `POST /api/v1/widget/<uuid>/data` | A saved widget on its own, without a canvas | `can_read` on `Widget`, the widget itself, and the binding's dataset |

Both take `{"runtime_filters": [{"datasetId": 1, "column": "country", "values": ["FR"]}]}` and answer `{"result": {"datasets": [{"name": "main", "row_count": 1, "inline_data": [...], "coltypes": {...}}]}}`, one dataset per binding the widget runs (see below); a dataset carries the `query` that ran, and its `language`, only for a caller who may view queries. One failing binding fails the request. Both also take `X-Widget-Draft` and `X-Widget-Version`, which name a draft and a version of the widget's own content for its widget type.

The saved widget endpoint is provisional. It is a synchronous stand-in for the asynchronous endpoint [SIP-231](https://github.com/apache/superset/issues/44875) section 8 describes, which answers a manifest of Arrow datasets, or a task while the result isn't cached yet, and its answer and path may change or be replaced when that endpoint lands.

## A widget type's bindings

By default a widget's data is its props' `dataBinding`, run as the dataset `main`. A widget type whose data isn't in its props, such as one whose props only refer to content it stores elsewhere, builds the bindings itself, by overriding `build_bindings`:

```python
from superset_core.widgets import (
    BindingRequest,
    Widget,
    WidgetBinding,
    WidgetDataRefusedError,
    widget,
)


@widget(widget_type="board", name="Board", description="...")
class Board(Widget):
    @classmethod
    def build_bindings(cls, request: BindingRequest) -> list[WidgetBinding] | None:
        content = load_content(request.widget_id, request.widget_version)
        if content is None:
            raise WidgetDataRefusedError("CONTENT_CHANGED", "Reload this board")
        return [WidgetBinding(name, binding) for name, binding in content.items()]
```

- **What it gets.** `BindingRequest` says where the host read the widget: the canvas and placement (both `None` for a saved widget on its own), the saved widget's UUID, its props, and the caller's canvas draft when the placement came from it, which the host has checked. `widget_draft_token` and `widget_version` are whatever `X-Widget-Draft` and `X-Widget-Version` said, passed on unchecked: they locate content and grant nothing, so a type that reads them checks that the caller may read what they name.
- **What it returns.** A binding has the shape of a `dataBinding`: `datasetId`, `metrics`, `dimensions`, `filters`, `orderBy` and `rowLimit`. Each is answered as the dataset of its name, so names must be unique. Return `None` to keep the host's default.
- **What the host checks.** Every binding a type builds is checked as a stored one is when it is written, before any of them runs: it must be a valid `dataBinding` with a plain integer `datasetId`, and the caller must be able to read its dataset. A binding without a `datasetId` isn't bound yet and is left out. A request runs at most `CANVAS_WIDGET_MAX_BINDINGS` bindings (20 by default), and Superset's row limits clamp a binding's own. A type that breaks these rules fails the request with a server error. The bindings then run as the caller, narrowed by the runtime filters on their datasets: a widget type decides what its widgets query, never who may read their data.
- **Refusing.** Raise `WidgetDataRefusedError(code, message, status=409)` to answer a request with your own code and message instead of any dataset, such as one that names content the widget no longer serves. The message reaches the caller, so it must say nothing they may not know.

Agents read the same bindings: the MCP tools `preview_widget` and `get_canvas_data` run what a widget type builds, with the same checks, and answer each as a dataset of its name; a refusal reaches them as `error_type` `WidgetDataRefused`, with the type's code in `error_code`.

`build_bindings` stands in for SIP-231's `QueryMixin.build_queries`, which builds `WidgetQuery` objects around a `SemanticQuery`. It will be replaced when that lands.
## Showing a saved widget outside a canvas

`canvas.WidgetHost` shows one saved widget on its own, on any page, in the cell a canvas draws around a placement: the title row, the slot the widget's own controls render into, its error boundary, and the canvas's "This widget is unavailable" placeholder. Its data comes from the saved widget endpoint above.

```tsx
import { canvas } from '@apache-superset/core';

<canvas.WidgetHost widgetId={uuid} filters={pageFilters} showTitle={false} />;
```

A canvas renderer is always given the canvas and placement it renders (`canvasId`, `nodeId`), so the host never runs one outside a canvas. A widget type shows in a widget host once it registers a renderer for a saved widget on its own:

```tsx
canvas.registerSavedWidgetRenderer('extensions.acme.kpi.kpi', SavedKpiTile);
```

That renderer gets `SavedWidgetProps`: the saved widget's `widgetId`, `widgetType`, `props` and `title`, the `filters` the page passes in, and `refreshKey`. The widget is the only node of its filter bus, so it has no cross-filters. A type without one shows the placeholder. The built-in data widgets (`echarts`, `metric-tile` and `ag-grid-table`) register theirs.

## Placements on the backend

An extension's own endpoint that serves its widget where a canvas places it, such as a route that answers a frame for a placement, reads the placement through `superset_core.canvas.placements`, so the caller reaches only what the canvas's own endpoints would show them:

```python
from superset_core.canvas import placements

try:
    widget_id, widget = placements.load_placed_widget(
        canvas_id, placement_id, draft_token, version=previewed_version
    )
except placements.PlacementNotFoundError:
    return self.response_404()
if widget.widget_type != MY_WIDGET_TYPE:
    return self.response_404()
can_change = widget_id in placements.editable_widgets({widget_id})
```

- `load_placed_widget(canvas_id, placement_id, draft_token=None, *, version=None)` answers the saved widget's UUID and its content (`StoredWidget`) as the canvas stores it, as the caller's draft of the canvas holds it, or as the saved version the canvas page previews placed it. The page names that version in `X-Canvas-Version` (`getActiveCanvas().previewedVersion` on the frontend); only the canvas's editors can read one, and a draft wins over it. A canvas, draft, version or placement the caller can't read looks the same as one that doesn't exist, and so does a placement that stores its own content, such as text: all raise `PlacementNotFoundError`.
- `editable_widgets(widget_ids)` answers which of the saved widgets the current user may change, as canvases decide it.

Neither reads a widget the caller can't. To read a saved widget on its own, use `superset_core.widgets.daos.WidgetDAO`, whose access filter applies.

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
