---
title: Dashboards
sidebar_position: 4
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

# Dashboard Renderer Contributions

Extensions can replace Superset's built-in dashboard renderer with a custom implementation. This allows dashboards to be displayed in entirely different ways — kiosk layouts, alternative grid engines, story-style presentations — while reusing Superset's data fetching, authentication, theming, and URL/permalink handling.

## Overview

The dashboard renderer is a **single-slot** contribution point:

- At most one custom renderer is active at a time. The most recently registered renderer wins; a previously registered renderer is displaced and unregistered with a console warning.
- When no custom renderer is registered, the host renders the built-in dashboard renderer.
- Custom renderers handle **view mode only**. When a dashboard enters edit mode, the host always renders the built-in renderer (which owns drag-and-drop editing, undo/redo, and the component pane), returning to the custom renderer when edit mode exits.
- A custom renderer that throws is contained by an error boundary; the host does not fall back to the built-in renderer on error.

The host keeps its behavior identical regardless of which renderer is active: it fetches the dashboard, charts, and datasets, resolves initial filter state from the URL (permalinks, `native_filters_key`, legacy filter params), injects dashboard CSS, and manages the document title. The renderer receives the results as props.

## The Props Contract

Your renderer component receives `DashboardRendererProps` from `@apache-superset/core/dashboards`:

| Prop | Type | Description |
|------|------|-------------|
| `dashboard` | `DashboardInfo` | Identity and parsed metadata: `id`, `uuid`, `slug`, `title`, `css`, `metadata` (parsed `json_metadata`), `layout` (parsed `position_json`), `isPublished`, `isManagedExternally` |
| `charts` | `DashboardChart[]` | Chart (slice) definitions as returned by `GET /api/v1/dashboard/{id}/charts` |
| `datasets` | `DashboardDataset[]` | Datasets as returned by `GET /api/v1/dashboard/{id}/datasets` |
| `initialDataMask` | `DashboardDataMask` | Initial filter state resolved by the host from the URL |
| `initialActiveTabs` | `string[]?` | Layout component ids of the initially active tabs (from permalink) |
| `initialAnchor` | `string?` | Layout component id to scroll to on mount (permalink anchor) |
| `uiConfig` | `DashboardUiConfig?` | Chrome-hiding flags (`hideTitle`, `hideTab`, `hideChartControls`, `emitDataMasks`), mirroring the embedded SDK's uiConfig |
| `onDataMaskChange` | callback? | Reserved — not supplied by the host yet |
| `onActiveTabsChange` | callback? | Reserved — not supplied by the host yet |

The contract is designed to be Redux-free: everything a renderer needs to display a dashboard arrives via props, and host services are available through the public `window.superset` namespaces (`authentication`, `navigation`, `theme`, `translation`, and so on).

### Renderer responsibilities

- **Chart data fetching**: the host does not fetch chart data. Query for it yourself (e.g. `POST /api/v1/chart/data` with query contexts built from each chart's `form_data`).
- **Filter orchestration**: applying `initialDataMask`, reacting to filter interactions, and refreshing affected charts are the renderer's responsibility.
- **Layout interpretation**: `dashboard.layout` is the parsed `position_json` component tree (rows, columns, tabs, charts, markdown); interpret as much or as little of it as your presentation needs.

Theming works out of the box: renderers are mounted inside the host's theme providers, so `useTheme` from `@apache-superset/core/theme` reflects the dashboard's active theme.

## Registering a Renderer

Register the renderer as a module-level side effect in your extension's entry point:

```typescript
import { dashboards } from '@apache-superset/core';
import type { ComponentType } from 'react';

const KioskDashboardRenderer: ComponentType<
  dashboards.DashboardRendererProps
> = ({ dashboard, charts, initialDataMask }) => (
  <main>
    <h1>{dashboard.title}</h1>
    {/* render charts from `charts` + `dashboard.layout` */}
  </main>
);

dashboards.registerDashboardRenderer(
  { id: 'acme.kiosk-dashboard', name: 'Kiosk Dashboard Renderer' },
  KioskDashboardRenderer,
);
```

`registerDashboardRenderer` returns a `Disposable`. Disposing it removes your renderer if it is still the active one; disposing after being displaced by a newer registration is a no-op.

You can observe slot changes with `dashboards.onDidRegisterDashboardRenderer` and `dashboards.onDidUnregisterDashboardRenderer`, and inspect the active provider with `dashboards.getDashboardRenderer()`.

## Manifest Declaration

Declare the renderer in your extension's `Contributions` metadata (at most one per extension):

```json
{
  "dashboardRenderer": {
    "id": "acme.kiosk-dashboard",
    "name": "Kiosk Dashboard Renderer",
    "description": "Full-screen kiosk presentation of dashboards"
  }
}
```

## Current Limitations

- Extensions load asynchronously after startup, so a dashboard opened before your extension finishes loading renders with the built-in renderer first and swaps to yours when registration lands.
- `onDataMaskChange` and `onActiveTabsChange` are defined in the contract but not consumed by the host yet — filter state changed inside a custom renderer does not persist to permalinks.
- While a custom renderer is active the host still hydrates its internal dashboard state so permalinks and embedded behavior remain intact; this is transparent to renderers but means the built-in state bookkeeping still runs.
