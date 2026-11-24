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
        canvas_id, placement_id, draft_token
    )
except placements.PlacementNotFoundError:
    return self.response_404()
if widget.widget_type != MY_WIDGET_TYPE:
    return self.response_404()
can_change = widget_id in placements.editable_widgets({widget_id})
```

- `load_placed_widget(canvas_id, placement_id, draft_token=None)` answers the saved widget's UUID and its content (`StoredWidget`) as the canvas stores it, or as the caller's draft of the canvas holds it. A canvas, draft or placement the caller can't read looks the same as one that doesn't exist, and so does a placement that stores its own content, such as text: all raise `PlacementNotFoundError`.
- `editable_widgets(widget_ids)` answers which of the saved widgets the current user may change, as canvases decide it.

Neither reads a widget the caller can't. To read a saved widget on its own, use `superset_core.widgets.daos.WidgetDAO`, whose access filter applies.
