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
`build_bindings` and the types it uses (`BindingRequest`, `WidgetBinding` and `WidgetDataRefusedError`, in `superset_core.widgets.bindings`) are provisional: a stand-in until SIP-231's query API, `QueryMixin.build_queries` with `WidgetQuery` and `SemanticQuery`. They may change, or be replaced by that API, under the [deprecation policy](../dependencies.md#api-evolution).
:::

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
        content = load_content(request.props["contentId"], request.canvas_version)
        if content is None:
            raise WidgetDataRefusedError("CONTENT_CHANGED", "Reload this board")
        return [WidgetBinding(name, binding) for name, binding in content.items()]
```

- **What it gets.** `BindingRequest` says where the host read the widget, all of which the host has checked the caller may read: the canvas and placement (both `None` for a saved widget on its own), the saved widget's UUID, its props, the caller's canvas draft when the placement came from it, and `canvas_version`, the UUID of the canvas version the placement came from when the page previews one (`X-Canvas-Version`; `getActiveCanvas().previewedVersion` on the frontend), which only the canvas's editors can read. A draft wins over a version, and `canvas_version` is then `None`. The caller's only input is the runtime filters, which the host applies to the bindings.
- **What it returns.** A binding has the shape of a `dataBinding`: `datasetId`, `metrics`, `dimensions`, `filters`, `orderBy` and `rowLimit`. Each is answered as the dataset of its name, so names must be unique. Return `None` to keep the host's default.
- **What the host checks.** Every binding a type builds is checked as a stored one is when it is written, before any of them runs: it must be a valid `dataBinding` with a plain integer `datasetId`, and the caller must be able to read its dataset. A binding without a `datasetId` isn't bound yet and is left out. A request runs at most `CANVAS_WIDGET_MAX_BINDINGS` bindings (20 by default), and Superset's row limits clamp a binding's own. A type that breaks these rules fails the request with a server error. The bindings then run as the caller, narrowed by the runtime filters on their datasets: a widget type decides what its widgets query, never who may read their data.
- **Refusing.** Raise `WidgetDataRefusedError(code, message)` to refuse a request instead of building bindings, such as one that names content the widget no longer serves; none of the widget's bindings then runs. `code` is for programs: your own name for why you refused, which keeps its meaning from one release to the next, so that your renderer can act on it, such as by reloading. `message` reaches whoever made the request as it is, so it must say nothing they may not know. The host presents a refusal the same way whatever its code: both data endpoints answer it as a 400 whose `error_type` is `WidgetDataRefused`, with your `code` and `message`.
