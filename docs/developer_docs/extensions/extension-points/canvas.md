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

Both take `{"runtime_filters": [{"datasetId": 1, "column": "country", "values": ["FR"]}]}` and answer `{"result": {"datasets": [{"name": "main", "row_count": 1, "inline_data": [...], "coltypes": {...}}]}}`; a dataset carries the `query` that ran, and its `language`, only for a caller who may view queries.

The saved widget endpoint is provisional. It is a synchronous stand-in for the asynchronous endpoint [SIP-231](https://github.com/apache/superset/issues/44875) section 8 describes, which answers a manifest of Arrow datasets, or a task while the result isn't cached yet, and its answer and path may change or be replaced when that endpoint lands.

## Showing a saved widget outside a canvas

`canvas.WidgetHost` is a proposal. It shows one saved widget on its own, on any page, in the cell a canvas draws around a placement: the title row, the slot the widget's own controls render into, its error boundary, and the canvas's "This widget is unavailable" placeholder. Its data comes from the saved widget endpoint above.

```tsx
import { canvas } from '@apache-superset/core';

<canvas.WidgetHost widgetId={uuid} showTitle={false} />;
```

It shows the built-in data widgets: `echarts`, `metric-tile` and `ag-grid-table`. Every other type shows the placeholder, an extension's included, and so does a built-in type whose renderer an extension replaced. A renderer registered with `canvas.registerWidgetRenderer` gets its context as props, the canvas it renders on (`canvasId`) among them, and outside a canvas there is no canvas to give it.

In [SIP-231](https://github.com/apache/superset/issues/44875) section 10, renderers get their context from hooks that each host backs: `useWidgetData`, `useRuntimeFilters` and `emitFilter`. Once those exist, a renderer doesn't know which host it renders in, and the one registry `canvas.registerWidgetRenderer` fills serves every host: a widget host then shows any type that has a renderer.
