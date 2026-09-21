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

# @apache-superset/widgets

Superset widgets (charts, metric tiles, tables, filters, markdown) as plain
React components. The Dashboard v2 builder renders its widgets from this
package, and any React app or AI-generated artifact can render the same
widgets in its own tree. Status: POC (initiative 3.13), not published.

## Usage

```tsx
import {
  SupersetProvider,
  Widget,
  Chart,
  MetricTile,
  FilterSelect,
  useSupersetFilter,
  useWidgetEvent,
} from '@apache-superset/widgets';

<SupersetProvider
  supersetDomain="https://superset.example.com"
  fetchGuestToken={() =>
    fetch('/api/superset-token', { method: 'POST' }).then(r => r.text())
  }
  themeMode="default" // 'default' | 'dark' | 'system'
>
  {/* inline: defined in the host, validated and executed by Superset */}
  <Chart
    dataBinding={{
      datasetId: 17,
      metrics: ['sum__num'],
      dimensions: ['state'],
      rowLimit: 10,
    }}
    chartType="bar"
    crossFilter
    echartsOptions={{
      xAxis: {
        type: 'category',
        data: { $bind: { source: 'dimension', alias: 'state' } },
      },
      yAxis: { type: 'value' },
    }}
  />
  <FilterSelect datasetId={17} column="gender" />

  {/* generic form of the same thing */}
  <Widget
    type="metric-tile"
    props={{
      dataBinding: { datasetId: 17, metrics: ['sum__num'] },
      label: 'Births',
    }}
  />

  {/* saved in Superset (GET /api/v1/widget/) */}
  <Widget id="cedf0501-fa36-4e19-9f84-e9da6d657dcc" />
</SupersetProvider>;
```

- Widgets fill their container; give the parent a size.
- Widgets under one provider share an event bus and cross-filter each other.
- Common props on every widget: `instanceId`, `className`, `style`, `fallback`, `renderError`.
- Typed components: `Chart`, `MetricTile`, `Table`, `FilterSelect`, `Markdown`.
  Their props mirror the widget's control schema
  (`GET /api/v1/widgets/type/<type>/control-schema`).
- `useSupersetFilter(key)` returns a setter for a host-owned filter
  `{ datasetId, column, operator, value, targets? }` (operators `EQUALS`,
  `NOT_EQUALS`, `IN`, `NOT_IN`, `RANGE`, `TIME_RANGE`), or `null` to clear.
- `useWidgetEvent('valueChanged', e => …)` receives filter and cross-filter
  selections from widgets (`e.payload.resolved`).
- `useWidgetValue(instanceId)` reads a widget's current selection.

## Extension widgets

A widget type contributed by a Superset extension embeds like any other — the
type names the extension that draws it, so the provider fetches that extension
and loads its frontend the first time one of its widgets renders:

```tsx
<Widget type="extensions.acme.widgets.funnel" props={{ dataBinding }} />
<Widget id="<uuid of a saved widget of that type>" />
```

The extension's module runs in the host page with the host's React, and gets a
`@apache-superset/core` whose `views` and `dashboard` namespaces are backed by
the embedded widget: `dashboard.getNode(nodeId)` returns the props the host
passed, `emit`/`on`/`getValue` are this provider's bus (so it cross-filters
with the built-in widgets), and `fetchQueryData` runs through the widget data
API under the page's own credentials. Contributions to anything other than
`dashboard.widgets`, and calls the embedded host cannot answer (placing nodes,
opening editors), are no-ops or throw rather than being silently wrong.

- `extensionWidgets={false}` turns loading off; a
  `createExtensionWidgetLoader({ supersetDomain, getGuestToken })` of your own
  replaces it (`createSession` takes one under the same name).
- The deployment needs `EMBEDDED_EXTENSION_ASSETS_PUBLIC = True` for guest
  tokens: extension chunks load as plain `<script>` tags, which cannot carry
  the token. With the browser's Superset session (same-site) it is not needed.
- Extensions built before the CLI's `publicPath: "auto"` default can only be
  embedded same-origin; their chunk URLs are pinned to the page's own origin.
- Claude artifacts cannot load extensions at all: there is no network to fetch
  the bundle from.

## Tokens

Mint guest tokens on your backend (`POST /api/v1/security/guest_token/`) after
authenticating your own user. Never mint them in the browser.

| You render     | The token needs                                                     |
| -------------- | ------------------------------------------------------------------- |
| `<Widget id>`  | `resources: [{ "type": "widget", "id": "<uuid>" }]`                 |
| inline widgets | `datasets: [<dataset id>, …]` (inline specs are refused without it) |

Add `rls` rules scoped to your user; without them the widget sees every row the
dataset returns. For guests, inline specs may only use saved metrics or simple
aggregates on existing columns: SQL metrics and SQL filters are rejected.
Filters from the host are always ANDed onto the widget's query.

## Superset configuration

```python
FEATURE_FLAGS = {"EMBEDDED_SUPERSET": True}
GUEST_ROLE_NAME = "Gamma"   # a role with can_read on Chart
ENABLE_CORS = True
CORS_OPTIONS = {
    "origins": ["https://app.example.com"],
    "resources": [r"/api/*"],
    "allow_headers": ["Content-Type", "X-GuestToken"],
}
```

Without `fetchGuestToken` the provider uses the browser's Superset session
(cookies); cross-origin that also needs `"supports_credentials": True`.

## Consuming from source

The package is not built for publishing yet. A host bundler must compile it and
its Superset dependencies from `src`:

- alias `@apache-superset/widgets`, `@apache-superset/core(/*)` and
  `@superset-ui/core(/*)` to `packages/<name>/src`;
- React automatic JSX runtime with `importSource: '@emotion/react'` and
  `@emotion/babel-plugin`;
- SVG imports as React components (svgr);
- define `process.env.NODE_ENV`, `process.env.WEBPACK_MODE`, `global`;
- dedupe `react`, `react-dom`, `@emotion/react`, `antd`.

[`example/vite.config.ts`](example/vite.config.ts) does all of this.

## Trust boundary

Widgets run in the host page's JavaScript context: the host trusts this code,
and an XSS in the host can read the guest token and any rows it grants. Keep
tokens short-lived and narrowly scoped. For third-party or untrusted hosts use
the iframe embed (`@superset-ui/embedded-sdk`).

## Embedding in Claude artifacts

Claude artifacts cannot make network requests or use browser storage, so the
REST client (and a token broker) cannot work there. Instead, data comes from
the **viewer's own Superset connector** in Claude: the page calls MCP tools
through the artifact runtime and never sees a token. Queries run with the
viewer's Superset permissions and row-level security.

Artifacts cannot install npm packages either, so they load the single-file
bundle (`superset-widgets.min.js`: React, the widgets and their CSS; sets
`window.SupersetWidgets`) from a CDN the artifact host allows, and drive it
through a session:

```js
const loadSupersetWidgets = url =>
  window.SupersetWidgets
    ? Promise.resolve(window.SupersetWidgets)
    : new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = url;
        script.onload = () => resolve(window.SupersetWidgets);
        script.onerror = () => reject(new Error(`Could not load ${url}`));
        document.head.appendChild(script);
      });

const W = await loadSupersetWidgets(BUNDLE_URL);
const session = W.createSession({
  server: 'Superset',
  strategy: 'query-dataset',
});
const chart = session.mount(element, {
  type: 'echarts',
  props: {
    chartType: 'bar',
    dataBinding: {
      datasetId: 17,
      metrics: ['sum__num'],
      dimensions: ['state'],
    },
  },
});
session.setFilter('state', {
  datasetId: 17,
  column: 'state',
  operator: 'IN',
  value: ['CA'],
});
const off = session.on('valueChanged', event =>
  console.log(event.nodeId, event.payload),
);
session.setThemeMode('dark');
chart.unmount();
session.dispose();
```

- **Session:** `createSession({server, strategy?, proxy?, themeMode?,
themeConfig?, mcp?, client?, loadFonts?})`. Every `mount(element, {type,
props} | {id}, {instanceId?, className?, style?, showTitle?})` is its own
  React root sharing one bus and data client, so widgets cross-filter.
  `setFilter(key, filter | null)` publishes `host:<key>`; `dispose()` unmounts
  everything and clears host filters. Fonts come from Google Fonts (the only
  stylesheet host artifacts allow) unless `loadFonts: false`.
- **React artifacts** keep their own React: mount into empty `ref` elements and
  never render children into them. See `artifact/examples/react-artifact.jsx`.
- **Build:** `node artifact/build.mjs` writes `artifact/dist/superset-widgets.min.js`
  and `artifact/dist/examples/inline.html` (bundle inlined, no CDN needed).
  With `SUPERSET_WIDGETS_URL=https://...` it also writes
  `artifact/dist/examples/cdn.html`.
- **MCP prompt:** `build_widget_artifact(connector_name, strategy,
artifact_kind)` hands Claude the loader, session API, specs and manifest.
  Set `MCP_WIDGETS_BUNDLE_URL` to the published bundle URL; without it the
  prompt tells Claude to ask the user for one.
- **In-tree React** apps that can install the package use
  `<SupersetArtifactProvider server strategy>` with the components directly.
- **Connector:** the viewer must have added Superset as a remote MCP connector
  in Claude; `server` is its display name.
- **Manifest:** publish with
  `capabilities: {mcp: {servers: [{server: "Superset", tools: [...]}]}}`, listing
  the tools the strategy calls. MCP-backed artifacts cannot be shared publicly.
- **Strategies:**
  - `widget-tools` (default): `get_widget_data`, `get_widget_values`,
    `get_saved_widget`. Supports saved widgets (`<Widget id>`) and every inline
    widget.
  - `query-dataset`: the existing `query_dataset` tool. Inline widgets only,
    saved metric names only, SIMPLE filters only.
  - `proxy`: set when the connector only exposes the `call_tool` meta-tool.
- **Errors** are `WidgetMcpError`s with a `code` and a message that says what
  fixes it (reconnect the connector, add it, approve access, try again).

## Design notes

- The widget, not the dashboard, is the unit of embedding. The builder
  implements the same `WidgetBus` / `WidgetDataClient` contracts as
  `SupersetProvider`, so there is one implementation of each widget.
- Those contracts live in `@apache-superset/core/widgets`, not here: what a
  widget is, and what it may ask of whoever renders it, is platform API that
  the builder, a host app and any extension writing a widget must agree on.
  This package implements them (and re-exports the types, so a host app needs
  one import), which keeps a charting runtime out of the module federation
  singleton every extension shares.
- Data always runs on the server through the widget registry
  (`Widget.fetch_data` / `fetch_values`), either from the stored definition
  (`{id}`) or from a validated inline spec (`{widget: {type, props}}`), via
  `POST /api/v1/widget/data` and `/values`.
- An extension's widget is loaded by the page that renders it, not bundled: the
  type (`extensions.<publisher>.<name>.<type>`) names the extension, and the
  same `views.registerView` call it makes in Superset registers it here.
- Open with other owners: widget JSON shape and data hook (3.8), bus and filter
  vocabulary (3.4), sandboxing extension widgets (3.17) — extension code runs
  in the host page's context today, on the host's trust.
