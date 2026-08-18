## What Happened

- **Verified:** A Time-Series chart with a top-oriented Plain legend and many
  grouped series rendered the legend across more rows than the chart grid had
  reserved.
- **Verified:** The expected behavior was for the grid to begin below every
  legend row. Instead, legend rows beyond the reserved margin were painted over
  the plot area.

## Root Cause

- **Verified:** `superset-frontend/plugins/plugin-chart-echarts/src/utils/series.ts`
  estimated the number of horizontal legend rows and calculated their full
  `requiredMargin`, but limited that margin to 40% of the available chart
  height. The same path always preserved `LegendType.Plain`, so ECharts rendered
  every item without pagination even when the reserved grid margin was smaller
  than the rendered legend.
- **Verified:**
  `superset-frontend/plugins/plugin-chart-echarts/src/Timeseries/transformProps.ts`
  passes the resolved legend margin through `getPadding`, which becomes the
  chart grid padding, and passes the preserved Plain type through
  `getLegendProps`. The underestimated margin therefore directly exposed the
  plot to the remaining legend rows.

## Why It Wasn't Caught

- **Verified:** Existing regression coverage ensured that an explicit Plain
  selection was not silently changed to Scroll, but its representative legends
  either fit or did not assert enough margin for all estimated rows.
- **Verified:** The existing overflow test asserted the 40%-of-height cap
  itself, so it encoded the behavior that caused the overlap rather than the
  minimum plot-space constraint the cap was intended to provide.
- **Inferred:** The layout tests treated preserving plot area and preserving the
  selected legend type as separate concerns, leaving the interaction between an
  unpaginated Plain legend and a capped grid margin uncovered.

## The Fix

- **Verified:**
  `superset-frontend/plugins/plugin-chart-echarts/src/utils/series.ts` adds an
  opt-in 80px minimum plot-space floor for callers that provide their fixed,
  non-legend height reservation. It reserves the full estimated legend margin
  whenever that leaves the floor intact and otherwise uses the remaining space.
  Callers without an accurate reservation retain the previous 40% ratio cap.
- **Verified:**
  `superset-frontend/plugins/plugin-chart-echarts/src/Timeseries/transformProps.ts`
  calculates the top and bottom padding required without a legend, including
  zoom controls and axis-title offsets. For horizontal-axis charts it uses the
  left padding that becomes bottom padding after the axis swap, then excludes
  those final-axis fixed reservations before applying the plot-space floor.
- **Verified:** The horizontal path continues to return `LegendType.Plain`; no
  Plain-to-Scroll fallback was added.
- **Verified:**
  `superset-frontend/plugins/plugin-chart-echarts/test/utils/series.test.ts` adds
  a 40-item, 800-by-400 regression case whose estimated eleven rows require a
  260px margin, and updates the small-chart overflow expectation to preserve an
  80px plot area.
- **Verified:** A transform-level regression test covers a 200px-tall zoomable
  chart with a many-item top Plain legend and verifies that the resulting grid
  retains 80px of plot height after both top and bottom padding.
- **Verified:** A second transform-level regression covers the same constraint
  after horizontal axes swap left and bottom padding.
- **Verified:** Mixed Timeseries coverage pins the pre-existing 40% fallback for
  shared-helper callers that have not opted into the floor-based calculation.
- **Verified:** Vertical Plain legend layout is unchanged.

## Latent Bugs Found

- **Verified:** `getVerticalPlainLegendLayout` sizes left/right margins from the
  longest label and selector width but does not account for the number of
  vertically stacked items. A tall vertical Plain legend can therefore extend
  beyond the plot. This is a separate orientation-specific defect and remains
  unchanged.
- **Verified:** The bottom-horizontal special case for
  `effectiveLegendType === LegendType.Scroll` in
  `superset-frontend/plugins/plugin-chart-echarts/src/Timeseries/transformProps.ts`
  is no longer reachable as a Plain-to-Scroll fallback because Plain is always
  preserved. It is still reachable for an explicitly selected Scroll legend,
  so it is not wholly dead. Its fallback-specific rationale is stale, but the
  branch remains unchanged to avoid broadening this fix.
- **Verified:** Mixed Timeseries, Gantt, Pie, Funnel, Radar, Bubble, and Graph
  share the legend-layout resolver but do not provide chart-specific fixed
  height reservations. They retain the legacy ratio cap until each caller can
  be migrated with its own layout accounting.

## Prevention

- **Verified:** The new regression test ties the reserved horizontal margin to
  the estimator's complete row count at realistic chart dimensions while also
  asserting that the user-selected Plain type is preserved.
- **Inferred:** Future legend layout changes should test the selected legend
  type, the estimated item capacity, and the resulting grid margin together,
  including a case that crosses any plot-preservation boundary and a sibling
  caller that must retain legacy behavior.
