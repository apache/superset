# Dataset-Aware Widget Controls — Design

**Status:** Approved for planning
**Branch:** `enxdev/poc/dashboard-v2-editing-ui-flow`
**Date:** 2026-08-20

## Problem

Dashboard V2's widget control panel is schema-driven end to end: a backend
`Widget.controls_class` (a Pydantic model) becomes a JSON Schema served at
`/api/v1/widgets/type/<widget_type>/control-schema`, rendered generically by
JsonForms in the Inspector's Form tab
([SchemaControlPanel.tsx](../../../superset-frontend/src/pages/DashboardBuilderV2/SchemaControlPanel.tsx)),
and written back through `provider.updateProps` — the same call an
AI/MCP-driven edit would use.

That machinery renders every field as a generic input keyed only to its JSON
type (string, number, array). It has no concept that a field's value is a
*reference into the widget's bound dataset* — a column name, a metric — so
fields like `BalloonsControls.dimensions` or `color_dimension`
([superset/widgets/controls.py](../../../superset/widgets/controls.py)) render
as bare text inputs, and `metrics` is forced into a raw-JSON editor
(`x-control: "code"`) purely because its entries are heterogeneous, not
because a real picker is impossible.

Reference UIs (Looker Studio / Power BI-style panels) tie each such field to
the dataset's column metadata: a type icon (ABC for string, 1.2 for numeric),
an ordered add/remove/drag list for multi-value fields (X axis, Y axis), and
per-category swatches for a chosen dimension's distinct values. The last of
these already exists in spirit — `BalloonsControls.Customization.series` uses
`x-dynamic` + `x-key-source` to enrich per-series color controls once a
grouping dimension is set — but the column/metric-reference fields themselves
have no equivalent.

SIP-182 (Semantic Layer support, apache/superset#35003) establishes the same
principle one layer up — an `Explorable` protocol with typed columns driving
a "reactive metric/dimension compatibility matrix" for semantic-layer
*connections*. It does not specify per-field UI rendering and this design
does not depend on it; the vocabulary (column type gates which control
renders) is the only thing borrowed.

## Scope

In scope: making fields *within* an existing widget's control schema
type-aware (column pickers, metric pickers, ordered multi-value lists).

Out of scope (deferred): swapping an already-placed widget's type in place
(the "Visualization" dropdown in the reference screenshots, e.g. Bar → Table).
That is a separate feature — changing `node.type` on a live node — and is not
addressed here.

## Approach

Two options were considered:

- **Extend the existing `x-control` vocabulary** (chosen) — add new
  `x-control` values alongside the existing `code`/`color` entries in
  [schemaControlRenderers.tsx](../../../superset-frontend/src/pages/DashboardBuilderV2/schemaControlRenderers.tsx),
  following the exact pattern already established there: a JsonForms tester
  matches the `x-control` value, the renderer fetches whatever data it needs
  and calls `handleChange`. The backend control model stays the single source
  of truth for which fields are column/metric references and which types
  they accept, declared declaratively via `json_schema_extra` — the same way
  `x-control: code` and `x-dynamic` are declared today.
- **Embed Superset's classic Explore controls** (`MetricsControl`,
  `DndColumnSelect`) directly — rejected. Those components are coupled to the
  Explore Redux slice; using them in Dashboard V2 would mean faking
  Explore-shaped state to borrow a widget, which works against the reason the
  schema-driven JsonForms system exists in the first place, and reintroduces
  exactly the legacy-pattern coupling the frontend modernization effort is
  moving away from.

## Design

### New `x-control` values

Declared via `json_schema_extra` on a Pydantic field, identically to how
`x-control: "code"` is declared today:

- `x-control: "column"` — single column reference. Optional
  `x-column-types: ["numeric" | "temporal" | "string"]` restricts which
  dataset columns are selectable; omitted means any column.
- `x-control: "column-multi"` — ordered list of column references (for
  `dimensions`-shaped fields): add, remove, and reorder (drag).
- `x-control: "metric"` — single metric reference (a saved metric name, or an
  ad-hoc aggregate expressible as one).
- `x-control: "metric-multi"` — ordered list of metric references.

`metrics` fields keep their existing raw-JSON (`x-control: "code"`) path as a
fallback for anything not expressible through the picker (this design does
not change or remove that path — see Error handling).

### Dataset metadata plumbing

A new `fetchDatasetColumns(datasetId)` helper is added to
`superset-frontend/src/core/dashboard/`, parallel to the existing
`fetchQueryData` in
[chartData.ts](../../../superset-frontend/src/core/dashboard/chartData.ts).
It calls the existing `/api/v1/dataset/<id>` REST endpoint (already used by
V1 Explore; no backend endpoint work is needed for this) and returns
`{ columns: [{ name, type, isTemporal, isNumeric }], metrics: [{ metricName,
verboseName }] }`. Results are cached per `datasetId` for the lifetime of the
Inspector session, mirroring the fetch-once-and-cache pattern
`schemaControlledWidgets.ts` already uses for widget types.

### New renderers

Added to `schemaControlRenderers.tsx` beside `CodeControl`/`ColorControl`:

- `ColumnControl` / `ColumnMultiControl` — fetch via
  `fetchDatasetColumns`, filter by the field's `x-column-types`, render an
  antd `Select` (single) or an ordered add/remove/drag list (multi). Each
  option is labeled with `ColumnTypeLabel` from `@superset-ui/chart-controls`
  (confirmed presentational, no Redux coupling — safe to reuse as-is).
- `MetricControl` / `MetricMultiControl` — same fetch, options are the
  dataset's saved metrics (`MetricOption` from the same package for the
  icon/label treatment), plus an escape hatch that drops to the existing
  `CodeControl` for a value not expressible as a saved metric.
- The two multi-controls share one small drag-list primitive implemented
  locally (plain `onDragStart`/`onDrop`) — no new dependency, since nothing
  in this layer currently pulls in a drag library.

### Data flow

Unchanged at the edges: every control still reads and writes `node.props`
through `provider.updateProps`, and the schema itself still comes from the
existing `/api/v1/widgets/type/<t>/control-schema` endpoint. The only new
network call is the dataset-columns/metrics fetch, and it is triggered
exactly the way `x-dynamic` already triggers `SchemaControlPanel`'s
`loadSeries` call today — off the presence of a field carrying the new
`x-control` value in the already-fetched schema, not off a new schema
capability flag.

Backend changes are additive and narrow, and land on the shared `DataBinding`
model so every widget that embeds it (`MetricTileControls`,
`AgGridTableControls`, `BalloonsControls`, `EchartsControls`) picks them up
uniformly rather than needing per-widget duplication:
`DataBinding.dimensions` gets `x-control: "column-multi"`, and
`DataBinding.metrics` gets `x-control: "metric-multi"` in place of its
current `x-control: "code"`. `BalloonsControls.color_dimension` separately
gets `x-control: "column"`. `EchartsControls.echarts_options` (a distinct
field, not `metrics`) is unaffected and stays free-form JSON, since its
`$bind` markers are not a fixed set of fields.

### Error handling

- A failed `fetchDatasetColumns` call fails open to a plain text/code input
  for the affected field, rather than blocking the panel — the same fail-open
  behavior `useSchemaControlledWidgetTypes` already applies to the widget
  registry fetch.
- A previously-picked column or metric that no longer exists on the dataset
  is shown selected but visually flagged (not silently cleared), consistent
  with `BalloonsControls`'s existing philosophy of surfacing invalid state
  through `validate_control_values` rather than swallowing it.

### Testing

- Backend: schema-shape assertions in the style of
  `tests/unit_tests/widgets/test_registry.py`, asserting each newly annotated
  field serves the expected `x-control`/`x-column-types` extras.
- Frontend: one Jest + React Testing Library test per new renderer (mirroring
  `SchemaControlPanel.test.tsx`), mocking `fetchDatasetColumns`; one
  integration-style test per control confirming a pick round-trips through
  `provider.updateProps` into `node.props`.

## Open questions

None outstanding — visualization-type swapping is explicitly deferred (see
Scope), and the reuse-vs-rebuild fork was resolved in favor of extending
`x-control` during design review.
