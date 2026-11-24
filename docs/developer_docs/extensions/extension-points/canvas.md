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

Both take `{"runtime_filters": [{"datasetId": 1, "column": "country", "values": ["FR"]}]}` and answer `{"result": {"datasets": [{"name": "main", "row_count": 1, "inline_data": [...], "coltypes": {...}}]}}`; a dataset carries the `query` that ran, and its `language`, only for a caller who may view queries.

The saved widget endpoint is synchronous, and stands in for the asynchronous one [SIP-231](https://github.com/apache/superset/issues/44875) section 8 describes, which answers a manifest of Arrow datasets, or a task while the result isn't cached yet. Its answer, and possibly its path, will change when that lands.

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
