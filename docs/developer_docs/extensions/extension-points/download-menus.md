---
title: Download Menus
sidebar_position: 5
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

# Download Menu Extension Points

Extensions can add items to the download menus for charts and dashboards. An item runs a command and passes it a context object that describes the chart or dashboard, including a function that returns the query behind the export.

## Locations

Register a menu item at one of these locations with `menus.registerMenuItem`, using the `primary` group.

| Location | Surface | Where the item appears |
| --- | --- | --- |
| `explore.chart.download` | Explore, chart actions menu | After "Export to Excel" |
| `explore.chart.download.pivoted` | Explore, chart actions menu | After "Export to Pivoted Excel" |
| `explore.standalone.download` | Explore, standalone download control | After "Export to Excel" |
| `dashboard.chart.download` | Dashboard, chart menu | After "Export to Excel" |
| `dashboard.chart.download.pivoted` | Dashboard, chart menu | After "Export to Pivoted Excel" |
| `chart.drillDetail.download` | Drill to detail pane | After "Export to Excel" |
| `chart.drillBy.download` | Drill by modal | After "Export to Excel" |
| `dashboard.download` | Dashboard download menu | After the Excel export entries |

The pivoted locations appear only where the chart offers "Export to Pivoted Excel". For those locations, `getPayload()` returns the query for the post-processed (pivoted) result.

## Context

The seven chart locations pass a `ChartDownloadContext` to the command:

```typescript
interface ChartDownloadContext {
  getPayload: () => Promise<ChartDataRequest>;
  chartId?: number;
  chartName: string;
  canDownload: boolean;
}

interface ChartDataRequest {
  datasource: { id: number; type: string };
  queries: object[];
  result_type: string;
  result_format: string;
  force?: boolean;
  form_data?: object;
}
```

- `getPayload()` is evaluated when called, so call it from the command. It resolves to the `/api/v1/chart/data` request body that the CSV export sends, with `result_format: 'json'`. Chart query builders run in CSV export mode before the response format is changed to JSON, preserving export row limits, filters and column order. Paginated tables export from the first row up to the configured row limit, rather than only the visible page.
- `chartId` is the ID of the saved chart the data comes from. It's absent for a chart that hasn't been saved. Drill to Detail and Drill By send the ID of the chart that was drilled into, since the drilled query has no saved chart of its own.
- `chartName` is the chart's title as shown, including a name set on the dashboard.
- `canDownload` is `false` when the current user lacks the permission to export the chart's data.

The `dashboard.download` location passes a `DashboardDownloadContext`:

```typescript
interface DashboardDownloadContext {
  dashboardId: number;
  dashboardTitle: string;
  activeDataMask: Record<
    string,
    {
      extraFormData: object;
      filterState: { value?: unknown; label?: string };
    }
  >;
  canDownload: boolean;
}
```

`activeDataMask` lists the applied native filters only, keyed by filter ID. Each entry carries `extraFormData` and `filterState` with `value` and `label`. Cross-filters and `ownState` are not included.

## Rules

- Chart items are disabled when `canDownload` is `false`.
- The dashboard item appears only where "Export Data to Excel" does, so it is hidden from users who cannot export.
- Image-only charts get no items in the Explore and dashboard chart menus. The standalone control keeps them, because it offers CSV and Excel for every chart.
- The context is read when the item is clicked, so `getPayload()` and `canDownload` reflect the state at that moment.
- Register the command **before** its menu item. An item whose command is not registered yet is skipped, and it appears only after the menu next re-renders.
- A command that throws or rejects is logged and does not break the menu.

## Example

```typescript
import { commands, menus } from '@apache-superset/core';

commands.registerCommand(
  { id: 'my-extension.export-rows', title: 'Export rows to My Service' },
  async ctx => {
    const payload = await ctx.getPayload();
    // Send the payload to the service, for example with `fetch`.
  },
);

menus.registerMenuItem(
  { view: 'explore.chart.download', command: 'my-extension.export-rows' },
  'explore.chart.download',
  'primary',
);
```

To report progress and the result to the user, see [Toasts](../toasts).
