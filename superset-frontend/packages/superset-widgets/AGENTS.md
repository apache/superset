# Embedding Superset widgets — instructions for coding agents

Use this when writing a React app or artifact that shows Superset data with
`@apache-superset/widgets`. Prefer it over inferring an API from code.

## Pick the form

- **Inline** (`<Chart>`, `<MetricTile>`, `<Table>`, `<FilterSelect>`,
  `<Markdown>`, or `<Widget type props>`): default for artifacts and generated
  apps. Nothing has to exist in Superset first.
- **Saved** (`<Widget id>`): when the user names an existing widget, or wants
  the query fixed and governed in Superset.

Everything goes under one `<SupersetProvider>`; widgets under the same provider
cross-filter each other.

Types come from this package (`HostFilter`, `ResolvedFilter`, `WidgetProps`
are re-exported); they are defined in `@apache-superset/core/widgets`, which
is what an extension authoring a widget imports instead.

## Never invent names or ids

- Dataset ids, column names and saved metric names: MCP `list_datasets`,
  `get_dataset_info` (or `GET /api/v1/dataset/<id>`).
- Widget props: MCP `get_widget_control_schema` for the widget type
  (`echarts`, `metric-tile`, `ag-grid-table`, `filter.select`, `markdown`).
- Saved widget ids: `GET /api/v1/widget/`.

If you can't look them up, ask.

## Inline props, minimal

```tsx
<Chart
  dataBinding={{ datasetId: 17, metrics: ['sum__num'], dimensions: ['state'], rowLimit: 10 }}
  chartType="bar"
  echartsOptions={{ xAxis: { type: 'category', data: { $bind: { source: 'dimension', alias: 'state' } } }, yAxis: { type: 'value' } }}
/>
<MetricTile dataBinding={{ datasetId: 17, metrics: ['sum__num'] }} label="Births" />
<FilterSelect datasetId={17} column="gender" />
```

- Metrics are saved metric names, or
  `{ expressionType: 'SIMPLE', aggregate: 'SUM', column: { column_name: 'num' } }`.
  No SQL expressions: guests are refused.
- `echartsOptions` is a normal ECharts option. Put data in with `$bind` markers:
  `{ $bind: { source: 'dimension' | 'metric', alias } }`, or
  `{ $bind: { source: 'records', fields: { name, value } } }` for pies.
- Give every widget a sized parent; widgets fill it.

## Extension widgets

A type like `extensions.acme.widgets.funnel` comes from a Superset extension.
Render it exactly like a built-in one (`<Widget type props>` or `<Widget id>`);
the provider loads the extension the first time it appears. Do not try to
import or bundle the extension yourself. It needs a `supersetDomain` provider,
so it cannot work in a Claude artifact, and guest-token pages need the
deployment's `EMBEDDED_EXTENSION_ASSETS_PUBLIC` on. Get its props from MCP
`get_widget_control_schema` for that type, same as any other widget.

## Host interaction

```tsx
const setState = useSupersetFilter('state');
setState({ datasetId: 17, column: 'state', operator: 'IN', value: ['CA'] }); // null clears
useWidgetEvent('valueChanged', e => console.log(e.nodeId, e.payload));
```

## Token broker (server-side, required)

- Mint with a Superset service account: `POST /api/v1/security/guest_token/`.
  Never from the browser; never put Superset credentials in `VITE_*` or
  `NEXT_PUBLIC_*` variables.
- Authenticate the app's own user first.
- Grant exactly what the page renders: `resources: [{ type: 'widget', id }]` for
  saved widgets, `datasets: [id]` for inline ones.
- Add `rls` rules scoped to the user. If the data is genuinely public, say so.

```ts
body: JSON.stringify({
  user: { username: user.id },
  resources: [{ type: 'widget', id: SAVED_WIDGET_ID }],
  datasets: [17],
  rls: [{ clause: `tenant_id = ${Number(user.tenantId)}` }],
});
```

## Superset config the host needs

`EMBEDDED_SUPERSET` on, `GUEST_ROLE_NAME` set, `ENABLE_CORS` with the host
origin, headers `Content-Type` and `X-GuestToken` on `/api/*`.

## Failures

- **403 on `/api/v1/widget/data`**: for a saved widget, the token doesn't name
  it; for an inline widget, the token has no `datasets` claim with that dataset.
- **400**: invalid props for the widget type, an unknown column in a filter, or
  a SQL metric/filter from a guest.
- **CORS error**: origin or `X-GuestToken` header missing from `CORS_OPTIONS`.

## Trust boundary

Widgets run in the host's JS context. Use `@superset-ui/embedded-sdk`
(iframe) when the host must not be trusted with the data.

## Embedding in Claude artifacts

- Artifacts have no network access and no storage: use
  `SupersetArtifactProvider` (MCP connector transport), never
  `SupersetProvider` with `supersetDomain`/`fetchGuestToken`, and never a
  token broker.
- `server` must be the Superset connector's display name in the viewer's
  Claude settings. Ask for it; do not guess.
- Declare the connector in the artifact manifest:
  `capabilities: {mcp: {servers: [{server, tools}]}}` with exactly the tools
  the strategy calls (`query_dataset`, or `get_widget_data`,
  `get_widget_values`, `get_saved_widget`). MCP artifacts cannot be public.
- Prefer `strategy: "widget-tools"` when the deployment has the widget tools;
  `query-dataset` supports inline widgets with saved metric names and SIMPLE
  filters only.
- Artifacts cannot import npm packages: load `superset-widgets.min.js` with a
  `<script>` from the published URL (the `build_widget_artifact` MCP prompt
  carries it when `MCP_WIDGETS_BUNDLE_URL` is set; otherwise ask the user).
  Never guess the URL or paste the bundle into the page.
- Drive it through `SupersetWidgets.createSession({server, strategy})`:
  `mount(element, {type, props} | {id}, {instanceId})`, `setFilter(key,
filter | null)`, `on("valueChanged", fn)`, `setThemeMode`, `dispose()`.
  One session per page.
- In a React artifact, mount into empty `ref` elements inside `useEffect`,
  dispose on cleanup, and never render children into those elements; the
  bundle brings its own React.
- Render each widget's error message as-is: it names the fix (reconnect, add
  the connector, approve access, retry later).
