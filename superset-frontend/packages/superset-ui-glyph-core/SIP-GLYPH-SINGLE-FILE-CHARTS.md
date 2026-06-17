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

# [SIP] Proposal for single-file chart plugins via `defineChart()` (the "Glyph" pattern)

> Draft — to be filed per the [SIP process](https://github.com/apache/superset/issues/5602).
> The SIP will be numbered by a committer upon acceptance.

### Motivation

Building a Superset visualization plugin today requires authoring and keeping in
sync five or more files per chart — `index.ts`, `controlPanel.ts`,
`transformProps.ts`, `buildQuery.ts`, `types.ts`, plus the component — wired
together through several layers of incidental complexity:

- **String-based control references.** Controls are referenced by name strings
  (`'metric'`, `'groupby'`, `'y_axis_format'`) that are resolved at runtime
  through registries and `expandControlConfig`. Typos fail silently; renames
  require grep-driven archaeology.
- **Array-of-arrays layouts.** Control panel layout is expressed as
  `controlSetRows: [[control], [control, control], [<JSX/>]]` — positional
  nesting that conflates layout with configuration and is hostile to both
  reading and tooling.
- **Triplicated knowledge.** The same fact (e.g. "this chart has a `showLegend`
  boolean defaulting to true") is restated in the control panel (control
  config), in transformProps (formData extraction + defaulting), and in the
  component's prop types. The three routinely drift.
- **No type safety across the seam.** `transformProps` output and component
  props are connected only by convention; mismatches surface as silently
  `undefined` props at runtime, not compile errors.

The result is a high floor for contributing a chart, and a maintenance burden
proportional to (charts × files × duplicated facts).

### Proposed Change

A new workspace package, **`@superset-ui/glyph-core`**, provides a
**`defineChart()`** function that defines a complete chart plugin in a single
file. The core idea: **argument definitions are the single source of truth**
for the control panel, the query, the transform, and the render props.

```tsx
export default defineChart({
  metadata: { name: t('My Chart'), thumbnail, behaviors: [Behavior.InteractiveChart] },
  arguments: {
    metric: Metric.with({ label: t('Metric') }),
    groupby: Dimension.with({ label: t('Dimension') }),
    showLegend: ShowLegend, // reusable preset
    legendType: { arg: LegendType, visibleWhen: { showLegend: true } },
  },
  transform: (chartProps, argValues) => ({ echartOptions: build(chartProps) }),
  render: props => <Echart {...props} />,
});
```

Key elements:

- **Argument classes** (`Metric`, `Dimension`, `Temporal`, `Select`, `Checkbox`,
  `Int`, `Slider`, `Color`, `ColorPicker`, `RadioButton`, `Bounds`, `Text`,
  `NumberFormat`, `Currency`, `TimeFormat`, `ConditionalFormatting`) declare
  what a chart needs; glyph-core generates the matching control configs,
  formData extraction with defaults, and typed render props.
- **Declarative conditions** — `visibleWhen` / `disabledWhen` replace
  imperative `visibility:` functions reaching into Redux controls state, with a
  single shared evaluator (`evaluateGlyphCondition`) usable from both the
  legacy pipeline and native rendering.
- **Generated `buildQuery`** for the common case (built on the core
  `getXAxisColumn`/`normalizeTimeColumn` helpers so time grain, adhoc x-axis
  columns, and the `DTTM_ALIAS` fallback behave identically to hand-written
  queries); charts with post-processing pass their own `buildQuery`.
- **Generated `transformProps`** maps formData → typed render props (metric
  label resolution via core `getMetricLabel`); charts with heavy transforms
  supply a `transform` whose return value is merged into render props.
- **Escape hatches for incremental migration** — `additionalControls`,
  `prependSections` / `middleSections` / `additionalSections`,
  `controlOverrides`, `formDataOverrides`, `onInit`, and
  `chartOptionsTabOverride` let complex charts keep hand-crafted sections while
  adopting the pattern for everything else.
- **Reusable presets** (`presets.ts`) — `ShowLegend`, `LegendType`,
  `LegendOrientation`, `HeaderFontSize`, `Subtitle`, etc. — shared,
  pre-translated argument configurations that keep label strings and defaults
  consistent across chart families.
- **Native Customize-tab rendering** — `GlyphOptionsPanel` renders glyph
  arguments directly from formData (value + visibility), bypassing the string
  expansion pipeline. The generated "Chart Options" section is identified by a
  structural `_glyphChartOptions` marker (never by label matching). Controls
  whose config requires `mapStateToProps` (e.g. ConditionalFormatting) and JSX
  rows (sub-section headers) route through the existing legacy renderer for
  full compatibility.

### Current Status (what has been done)

All work lives on `feat/glyph-single-file`. **Every chart family in the main
preset has been consolidated** to `defineChart()`:

- **plugin-chart-echarts**: Pie, Funnel, Gauge, Sankey, Waterfall, Histogram,
  Tree, Bubble, BoxPlot, Sunburst, Radar, Treemap, Graph, Heatmap, Gantt,
  BigNumber, BigNumberWithTrendline, BigNumberTotal, BigNumberPeriodOverPeriod,
  Timeseries (Generic, Area, Bar, Line, Scatter, SmoothLine, Step),
  MixedTimeseries
- **preset-chart-deckgl**: all 11 layers (Arc, Contour, Geojson, Grid, Heatmap,
  Hex, Path, Polygon, Scatter, Screengrid, Multi)
- **legacy plugins**: calendar, horizon, chord, country-map, world-map,
  paired-t-test, parallel-coordinates, partition, rose
- **legacy-preset-chart-nvd3**: Bubble, Bullet, Compare, TimePivot
- **others**: table, pivot-table, ag-grid-table (light-touch), word-cloud,
  point-cluster-map, handlebars, cartodiagram

Net effect: **−13,000 lines** (+60k/−73k across 482 files).

**Test coverage added**: a 168-test suite spanning glyph-core unit tests
(arguments, defineChart, presets, crossFilter — including regression tests for
every audit finding below), `GlyphOptionsPanel` component tests, plugin-level
smoke tests for migrated charts, and a Playwright E2E test for the Customize
tab.

**A full-branch audit (2026-06-11)** ran a seven-angle review over the diff;
17 findings were confirmed and 14 fixed in-tree, notably:

- `behaviors` no longer defaults to `[Behavior.InteractiveChart]` — charts must
  opt in, matching `ChartMetadata`'s own default (21 charts had acquired dead
  cross-filter UI).
- The real `BigNumberTotalChartPlugin` is registered under
  `big_number_total` again (a demo plugin had displaced it, breaking saved
  charts' formats and subheaders).
- `@superset-ui/glyph-core` added to root `package.json` so webpack's
  workspace-alias loop resolves live `src/` (fresh builds previously failed).
- Explore's initial-query effect is one-shot again — filling in the last
  invalid control no longer auto-fires a query for any chart type.
- `ChartDefinition.metadata` can now express `queryObjectCount`,
  `dynamicQueryObjectCount`, `parseMethod`, `suppressContextMenu`, and
  `enableNoResults` (Mixed Chart's second Results tab returned).
- `disabledWhen` reads controls from the correct `mapStateToProps` argument
  (the API was previously non-functional).
- Generated queries carry `timeGrain` on the x-axis column; generated metric
  extraction uses `getMetricLabel` and no longer guesses among multiple numeric
  columns.
- `NumberFormat`/`TimeFormat` options derive from chart-controls'
  `D3_FORMAT_OPTIONS` (translated, with previews) instead of stale copies.
- Dead parallel implementation (`generators.ts`, 419 lines + tests + orphaned
  types) deleted; condition evaluation deduplicated to a single function.
- `scripts/check-custom-rules.js` suppression matching is line-based (real
  ESLint semantics) — one disable comment can no longer silence an entire
  subtree; the leaks it had hidden were fixed with properly scoped disables.

Branch health: full-monorepo `tsc --noEmit` clean, all 24 packages build, all
tests and the complete pre-commit suite (mypy, ruff, pylint, oxlint, prettier,
frontend type-check, custom rules) pass.

### New or Changed Public Interfaces

- **New package** `@superset-ui/glyph-core` (workspace package; public API:
  `defineChart`, argument classes, presets, `evaluateGlyphCondition`,
  `getGlyphControlConfig`, `resolveArgClass`, cross-filter utilities).
- **`@superset-ui/chart-controls`**: `ControlPanelConfig._glyphArgs` and
  `ControlPanelSectionConfig._glyphChartOptions` — `@internal` structural
  markers consumed by explore.
- **`@superset-ui/core`**: `Behavior.AllowsEmptyResults` added to the
  `Behavior` enum (no producer yet — see Remaining Work).
- **Explore**: new `GlyphOptionsPanel` component; `ControlPanelsContainer`,
  `ExploreChartPanel`, `ExploreViewContainer`, `ChartRenderer`, and
  `getSectionsToRender` learned the glyph path alongside the legacy one.
- **REST API**: `ChartDataExtrasSchema` accepts an optional
  `allow_empty_query` boolean (`load_default=False`); `get_sqla_query` honors
  it for validation while refusing to compile a zero-column SELECT.
- No new CLI surface, no deployment changes.

### New dependencies

None. `@superset-ui/glyph-core` is a new in-repo workspace package depending
only on existing workspace packages (`@superset-ui/core`,
`@superset-ui/chart-controls`). No new npm or PyPI dependencies.

### Migration Plan and Compatibility

- **No database migrations.** Saved charts keep their `viz_type` keys and
  form data; `defineChart` plugins register under the same keys.
- **Form-data compatibility** is preserved through generated controls using the
  same shared control names (`metric`, `groupby`, `adhoc_filters`, `x_axis`,
  `time_grain_sqla`) and per-chart transforms reading legacy keys. One known
  gap remains (camelCase arg keys vs. saved snake_case keys — see Remaining
  Work item 2).
- **Incremental by design**: the legacy `controlPanel` pipeline still works
  untouched; glyph charts coexist with non-migrated charts. Removal of legacy
  controlPanel support is an explicit later phase, gated on the roadmap below.

### Remaining Work / Roadmap

Ordered by priority; items 1–3 should land before this branch merges or
immediately after.

1. **Restore code-splitting (perf regression).**
   `loadChart: () => Promise.resolve(Component)` makes every migrated
   renderer — including maplibre-gl (~800 KB) and deck.gl — eager in the
   initial bundle, where master lazy-loaded them via
   `loadChart: () => import('./Chart')`. Add lazy-render support to
   `defineChart` (e.g. `render: () => import('./Render')` or a
   `loadRender` field) and move heavy renderers back behind dynamic imports.
2. **Per-arg `formDataKey` aliases (saved-chart compatibility).**
   Some migrated charts renamed keys (e.g. BigNumberTotal's `yAxisFormat` /
   `subtitle` vs. saved `y_axis_format` / `subheader`). Rendering works via
   camelCase conversion and transform fallbacks, but explore controls show
   defaults for saved charts and write parallel keys. A
   `formDataKey: 'y_axis_format'` alias on argument definitions fixes this
   generally — and is the foundation for settings transfer between viz types
   (arguments sharing a semantic key carry over on viz-type switch).
3. **Typed escape hatch for legacy transforms.**
   ~14 plugins (table, pivot-table, ag-grid, all deckgl layers,
   point-cluster-map) use `transform: p => transformProps(p as any) as any`
   plus `render: props => <Comp {...(props as any)} />`. This double-cast class
   is what previously hid a silent render-props bug. Provide a
   `defineChart<Props>` overload (typed transform fully replaces render props)
   or a `wrapLegacyTransform(transformProps, Component)` helper so the next
   shape mismatch is a compile error.
4. **Collapse the dual control-panel pipeline.**
   `defineChart` currently emits a full legacy `ControlPanelConfig` *and*
   native `_glyphArgs`; visibility/disabled/validation exist in both paths
   with different data sources (Redux controls vs. formData). Make the native
   definition canonical and derive the legacy config as a thin adapter — this
   is the enabler for the planned consistent section/area rendering schema.
5. **Extract shared timeseries transform logic.**
   The six Timeseries-family charts each inline ~1,200 lines of largely
   duplicated transform code. Hoist a shared `timeseriesTransform` into
   glyph-core (or a glyph-echarts helper) before the copies drift.
6. **Resolve the `allow_empty_query` plumbing.**
   Backend accepts the flag and `Behavior.AllowsEmptyResults` exists, but
   nothing produces either. Either wire the drag-and-drop empty-chart flow
   end-to-end (derive the extras flag from chart metadata in one place) or
   drop the speculative plumbing until the feature lands.
7. **Finish the migration and remove legacy controlPanel support** once 1–4
   are in place, per the original plan: every plugin on `defineChart`, the
   string-expansion pipeline (`expandControlConfig`, array-of-arrays sections)
   deleted, and chart wrappers reduced to enable animation/realtime rendering.

### Rejected Alternatives

- **`createGlyphPlugin()` builder API** (a Map-based generator predating
  `defineChart`): shipped briefly as `generators.ts`, never adopted by any
  chart, drifted from the real implementation, and was deleted during the
  audit in favor of the single `defineChart()` entry point.
- **JSON/YAML chart manifests**: a pure-data format can describe controls but
  not transforms or renderers, forcing a second mechanism anyway; a typed
  TypeScript API keeps definition, transform, and render in one
  compiler-checked file.
- **Fixing the legacy controlPanel format in place** (e.g. typed control
  references over the existing array-of-arrays): preserves the triplication of
  knowledge across controlPanel/transformProps/component and the runtime
  string-resolution layer that motivates this SIP.
- **Big-bang removal of the legacy pipeline**: rejected in favor of
  coexistence + escape hatches; third-party plugins and complex charts need a
  migration window.
