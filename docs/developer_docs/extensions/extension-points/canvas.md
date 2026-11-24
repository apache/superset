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

## Publish participants

A widget whose content keeps a draft of its own, which the canvas draft that places it shows, needs that draft published with the canvas: published alone, the canvas would show viewers nothing where the widget is new, or what it showed before. An extension has the canvas publish its drafts too, from the canvas page, and refuse a commit that would leave them out, on the server.

On the frontend, `canvas.registerPublishParticipant({ prepare })` takes part in publishing a draft from the canvas page, and returns a `Disposable` that ends its part. When the person publishes, the page asks each participant's `prepare(draft)` what publishing the draft also publishes, given the canvas, the draft's token and the saved widgets it places, and lists every part (`title`, `lines`) in a confirmation before anything is published. Once the person confirms, the page publishes each part (`publish()`, which may answer `notices` to show) and then the canvas; the first part that fails stops the publish with its message.

On the backend, `register_commit_participant(participant)` from `superset_core.canvas.drafts` is asked before every commit, whichever way it was asked (the canvas page, the REST API or an agent's tool), under the draft's lock and before anything is written. It returns the participant, so it works as a decorator:

```python
from superset_core.canvas import drafts


@drafts.register_commit_participant
def notes_published(commit: drafts.DraftCommit) -> None:
    if unpublished_notes(commit.token, commit.widget_types):
        raise drafts.CommitRefusedError(
            "NOTES_UNPUBLISHED", "Publish the canvas from its page."
        )
```

A refusal fails the commit with its code and message, a 409 `DraftCommitRefused` with `refusalCode` on the REST API and `refusal_code` on the MCP tool, and nothing is written. A participant runs in the context of the extension that registered it.

Both have limits:

- A publish with parts is several requests, not one transaction: a part that went out stays out when a later part, or the canvas, doesn't. The confirmation then says which went out, and publishing again from it publishes only the parts that didn't.
- Only the page's publish asks publish participants. A commit that skips the page, such as an agent's, publishes no part, and a commit participant can only refuse it, not publish what it waits for.

## Widget data

A widget's data is always queried on the server, from what is stored: the caller only adds runtime filters, the values of the canvas filters and cross-filters that reach the widget, which narrow the binding's own dataset. Each query runs as the caller, through the chart data pipeline, so dataset access, row level security and caching apply as for any chart.

| Endpoint | Reads | Access |
| --- | --- | --- |
| `POST /api/v1/canvas/<id_or_uuid>/placement/<placement_id>/data` | A placement, from the stored canvas, the caller's draft of it (`X-Canvas-Draft`), or one of its versions (`X-Canvas-Version`) | The canvas, and the binding's dataset |
| `POST /api/v1/widget/<uuid>/data` | A saved widget on its own, without a canvas | `can_read` on `Widget`, the widget itself, and the binding's dataset |

Both take `{"runtime_filters": [{"datasetId": 1, "column": "country", "values": ["FR"]}]}` and answer `{"result": {"datasets": [{"name": "main", "row_count": 1, "inline_data": [...], "coltypes": {...}}]}}`, one dataset per binding the widget runs (see below); a dataset carries the `query` that ran, and its `language`, only for a caller who may view queries. One failing binding fails the request, and a widget type may refuse it.

The saved widget endpoint is provisional. It is a synchronous stand-in for the asynchronous endpoint [SIP-231](https://github.com/apache/superset/issues/44875) section 8 describes, which answers a manifest of Arrow datasets, or a task while the result isn't cached yet, and its answer and path may change or be replaced when that endpoint lands.

## A widget type's bindings

:::note Provisional
`build_bindings` and the types it uses (`BindingRequest` and `WidgetBinding`, in `superset_core.widgets.bindings`) are provisional: a stand-in until SIP-231's query API, `QueryMixin.build_queries` with `WidgetQuery` and `SemanticQuery`. They may change, or be replaced by that API, under the [deprecation policy](../dependencies.md#api-evolution).
:::

By default a widget's data is its props' `dataBinding`, run as the dataset `main`. A widget type whose data isn't in its props, such as one whose props only refer to content it stores elsewhere, builds the bindings itself, by overriding `build_bindings`:

```python
from superset_core.widgets import BindingRequest, Widget, WidgetBinding, widget


@widget(widget_type="board", name="Board", description="...")
class Board(Widget):
    @classmethod
    def build_bindings(cls, request: BindingRequest) -> list[WidgetBinding] | None:
        content = load_content(request.props["contentId"], request.canvas_version)
        return [WidgetBinding(name, binding) for name, binding in content.items()]
```

- **What it gets.** `BindingRequest` says where the host read the widget, all of which the host has checked the caller may read: the canvas and placement (both `None` for a saved widget on its own), the saved widget's UUID, its props, the caller's canvas draft when the placement came from it, and `canvas_version`, the UUID of the canvas version the placement came from when the page previews one (`X-Canvas-Version`; `getActiveCanvas().previewedVersion` on the frontend), which only the canvas's editors can read. A draft wins over a version, and `canvas_version` is then `None`. The caller's only input is the runtime filters, which the host applies to the bindings.
- **What it returns.** A binding has the shape of a `dataBinding`: `datasetId`, `metrics`, `dimensions`, `filters`, `orderBy` and `rowLimit`. Each is answered as the dataset of its name, so names must be unique. Return `None` to keep the host's default.
- **What the host checks.** Every binding a type builds is checked as a stored one is when it is written, before any of them runs: it must be a valid `dataBinding` with a plain integer `datasetId`, and the caller must be able to read its dataset. A binding without a `datasetId` isn't bound yet and is left out. A request runs at most `CANVAS_WIDGET_MAX_BINDINGS` bindings (20 by default), and Superset's row limits clamp a binding's own. A type that breaks these rules fails the request with a server error. The bindings then run as the caller, narrowed by the runtime filters on their datasets: a widget type decides what its widgets query, never who may read their data.

Agents read the same bindings: the MCP tools `preview_widget` and `get_canvas_data` run what a widget type builds, with the same checks, and answer each as a dataset of its name, within the tools' own caps (`get_canvas_data` counts every binding against its `max_widgets`).

## Showing a saved widget outside a canvas

`canvas.WidgetHost` is a proposal. It shows one saved widget on its own, on any page, in the cell a canvas draws around a placement: the title row, the slot the widget's own controls render into, its error boundary, and the canvas's "This widget is unavailable" placeholder. Its data comes from the saved widget endpoint above.

```tsx
import { canvas } from '@apache-superset/core';

<canvas.WidgetHost widgetId={uuid} showTitle={false} />;
```

It shows the built-in data widgets: `echarts`, `metric-tile` and `ag-grid-table`. Every other type shows the placeholder, an extension's included, and so does a built-in type whose renderer an extension replaced. A renderer registered with `canvas.registerWidgetRenderer` gets its context as props, the canvas it renders on (`canvasId`) among them, and outside a canvas there is no canvas to give it.

In [SIP-231](https://github.com/apache/superset/issues/44875) section 10, renderers get their context from hooks that each host backs: `useWidgetData`, `useRuntimeFilters` and `emitFilter`. Once those exist, a renderer doesn't know which host it renders in, and the one registry `canvas.registerWidgetRenderer` fills serves every host: a widget host then shows any type that has a renderer.
