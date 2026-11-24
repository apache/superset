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

The saved widget endpoint is synchronous, and stands in for the asynchronous one [SIP-231](https://github.com/apache/superset/issues/44875) section 8 describes, which answers a manifest of Arrow datasets, or a task while the result isn't cached yet. Its answer, and possibly its path, will change when that lands.

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
