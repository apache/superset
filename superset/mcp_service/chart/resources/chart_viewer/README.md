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

# Superset MCP Chart Viewer

A polished, single-file MCP **App** widget (React + ECharts) for Apache Superset's
MCP server. It renders Superset `ChartData` natively inside MCP Apps hosts
(Claude, ChatGPT) via the [MCP Apps standard](https://github.com/modelcontextprotocol/ext-apps),
and degrades gracefully to a standalone demo when run outside a host.

The build emits **one self-contained `dist/index.html`** (all JS + CSS inlined)
that can be served as a single MCP UI resource.

## Build

```bash
npm install
npm run build      # tsc typecheck -> vite build -> single-file + size report
npm run test       # vitest unit tests for the adapter
npm run dev        # standalone dev server with sample data
```

**Final bundle size:** `dist/index.html` ≈ **778 KiB** (267 KiB gzipped) —
comfortably under the 1.5 MB budget. ECharts is imported via `echarts/core` with
only the Line/Bar charts, Grid/Tooltip/Legend/DataZoom/Brush/MarkArea components,
and the UniversalTransition + LabelLayout features registered (tree-shaken).

## Packaging

`dist/index.html` is gitignored and produced at build time, mirroring how
`superset/static/assets` is handled. `MANIFEST.in` ships that single file:

```
include superset/mcp_service/chart/resources/chart_viewer/dist/index.html
```

Verified behaviour of that entry (built locally with setuptools 80.9.0):

- **Wheel** — contains `superset/mcp_service/chart/resources/chart_viewer/dist/index.html`
  whenever the file exists at build time, via `include_package_data=True`.
- **sdist** — contains *only* `dist/index.html`. The widget's `package.json`,
  `package-lock.json` and `src/` are **not** in the sdist, so the widget
  **cannot** be rebuilt from a released tarball.

**Nothing in `setup.py` / `pyproject.toml` builds this widget** — exactly as
nothing in them builds `superset-frontend`. Both are separate steps owned by the
release process, so the build must happen *before* `python -m build`:

- **PyPI release** — wired into `RELEASING/README.md`, in the "Create the
  distribution" block, next to the existing `superset-frontend` build.
- **Docker image (known gap)** — `Dockerfile` builds `superset-frontend` in the
  `superset-node` stage and copies `superset/static/assets` into the final
  image, but has no equivalent step for this widget. `COPY superset superset`
  brings the widget's *source* into the image, not its build output (`dist/` is
  gitignored, so it is absent from a clean checkout). Official images therefore
  serve the placeholder resource. Closing this requires an `npm ci && npm run
  build` for this directory in the `superset-node` stage, a
  `COPY --from=superset-node .../chart_viewer/dist` after `COPY superset
  superset`, and a `superset/mcp_service/chart/resources/chart_viewer/dist/`
  entry in `.dockerignore` (matching the existing `superset/static/assets/`
  entry).

When `dist/index.html` is missing, `chart_viewer.py` serves a placeholder rather
than failing, so a mis-built artifact degrades quietly — check for the file
explicitly. CI asserts it is emitted (`.github/workflows/mcp-chart-viewer.yml`).

## Input data contract (`ChartData`)

The tool result the widget receives mirrors `ChartData` in
`superset/mcp_service/chart/schemas.py`:

```ts
{
  chart_id: number;
  chart_name: string;
  chart_type: string;   // a Superset viz_type, e.g. "echarts_timeseries_line",
                        // "echarts_timeseries_bar", "echarts_area",
                        // "big_number_total", "table", "pie"
  columns: Array<{
    name: string;
    display_name: string;
    data_type: "numeric" | "temporal" | "string" | "boolean";
    sample_values: any[];
    null_count: number;
    unique_count: number;
    semantic_type?: string | null;   // "percentage", "currency", ...
  }>;
  data: Array<Record<string, any>>;   // row objects keyed by column name
  row_count: number;
  total_rows: number | null;
  summary?: string;
  insights?: string[];
  recommended_visualizations?: string[];
  data_quality?: Record<string, any>;
}
```

The host may additionally pass, in the tool-result `_meta`, an
**`explore_url`** deep link. When present the widget shows an
**"Open in Superset"** button that requests the host open it (`ui/open-link`).

The payload is read from either `structuredContent` or the first JSON `text`
content block of the `CallToolResult` — whichever the host provides.

## `render_chart_requery` tool contract

Drill-down and brush-to-zoom call an **app-visible** server tool (a tool with
`visibility: ["app"]`, hidden from the model). The widget expects it to be named
`render_chart_requery` and to accept:

```ts
{
  chart_id: number;
  filter?: { col: string; val: any };// drill into a clicked value
  time_range?: string;               // e.g. "2026-01-01 : 2026-01-08"
  granularity?: string;              // best-effort time-grain hint
}
// Note: dimension-pivot (group_by) was removed — Superset's extra_form_data
// merge ignores groupby, so it was a silent no-op. Drill via filter/time_range.
```

It must return a fresh `ChartData` object (same schema as above). The widget
swaps it in with a smooth transition and shows a **Reset** affordance.

If the host does not expose this tool, all re-query affordances are disabled
cleanly and the widget remains a great static chart.

## Rendering

`adapter.ts` exposes the pure function
`chartDataToEChartsOption(data, viewType, { theme, activeMetrics })` plus helpers
(`classifyColumns`, `defaultViewForChartType`, `availableViews`,
`resolveBigNumber`, `buildSparklineOption`). View types:

- **line / area / bar** — x from the temporal column (else first string column),
  y from numeric columns; multiple numeric columns become multiple series with a
  legend. Smooth lines, area gradients, rich axis-aware tooltips, responsive grid.
- **big number** — a single large KPI value with the metric name and an optional
  trend sparkline when a temporal column exists.
- **table** — dense, sortable, sticky-header, zebra-striped, right-aligned numerics.

Unknown `chart_type` values fall back to the styled **table** view; the incoming
`chart_type` is mapped to a sensible default view on load. Numbers and dates are
formatted with `d3-format` / `d3-time-format` (compact `1.2M`, percentages for
`semantic_type: "percentage"`, locale-aware dates).

## Capability detection

Every host-dependent feature is gated behind capability detection performed
during the `ui/initialize` handshake (`bridge.ts`):

| Feature | Gate |
| --- | --- |
| Click-to-drill / brush-to-zoom | `tools/call` supported **and** `render_chart_requery` advertised (or callable) |
| "Ask about this" | `ui/update-model-context` and/or `ui/message` supported |
| "Open in Superset" | `explore_url` present in tool-result `_meta` |
| Theme sync | host `hostContext.theme` / `colorScheme`, else `prefers-color-scheme` |

When no host answers the handshake, the widget runs in **standalone mode** with
bundled sample data — useful for local dev and for minimal hosts.

## Magic moments implemented

1. **Animated view morphing** — switching line ⇄ bar ⇄ area uses ECharts
   `universalTransition` with stable per-metric series `id`s, so bars morph into
   lines.
2. **Click-to-drill** — clicking a temporal data point calls
   `render_chart_requery` with a `filter` + best-effort `granularity` hint and
   swaps in the returned `ChartData` (gated on host capability). Some saved
   query contexts ignore the time-grain override, so the widget does not claim
   that returned rows were re-bucketed.
3. **Brush-to-zoom re-query** — dragging a range on a time series calls
   `render_chart_requery` with a narrowed `time_range`; a **Reset drill** pill
   restores the full view.
4. **"Ask about this"** — selecting a point offers an action that pushes a concise
   context string (`ui/update-model-context` + `ui/message`) like
   `User is looking at Mobile=26.8k for Week=Jan 12, 2026 in "…"`.
5. **Live metric switcher chips** — when multiple numeric columns exist, chips
   toggle series in/out without a re-query.

## Bridge / MCP Apps protocol

`bridge.ts` is a thin, isolated transport that speaks the documented
JSON-RPC-2.0-over-postMessage dialect from the MCP Apps spec (2026-01-26):
`ui/initialize` (handshake receiving host capabilities + context + tool result),
`ui/notifications/initialized`, `ui/notifications/tool-result` and
`ui/notifications/host-context-changed` (host → view pushes), `tools/call`,
`ui/update-model-context`, `ui/message`, `ui/open-link`, and
`ui/notifications/size-changed`.

The rest of the app depends only on this interface, never on a vendor package,
so the transport can be swapped for `@modelcontextprotocol/ext-apps`' `App`
class without touching the UI. (`@modelcontextprotocol/ext-apps` is declared as a
dependency and installs cleanly; the direct-postMessage implementation is used so
the widget owns its wire contract and stays resilient to host variations.)

## Files

```
chart_viewer/
├── index.html            # mount point (title, #root)
├── vite.config.ts        # single-file build + vitest config
├── package.json / tsconfig.json
├── scripts/report-size.mjs
└── src/
    ├── main.tsx          # React entry
    ├── App.tsx           # orchestration, states, magic moments
    ├── adapter.ts        # ChartData -> EChartsOption (pure, tested)
    ├── adapter.test.ts   # vitest unit tests
    ├── bridge.ts         # MCP Apps postMessage bridge (isolated)
    ├── theme.ts          # Superset palette + light/dark tokens
    ├── format.ts         # d3 number/date formatting
    ├── echarts.ts        # tree-shaken ECharts registration
    ├── sample-data.ts    # standalone-mode fixtures
    ├── styles.css        # Superset-flavored chrome
    └── components/        # Toolbar, EChart, BigNumber, DataTable, States
```
