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
  `superset-frontend/plugins/plugin-chart-echarts/src/utils/series.ts` replaces
  the horizontal 40% cap with an 80px minimum plot-space floor. It reserves the
  full estimated legend margin whenever that leaves at least 80px for the plot;
  for larger legends, it reserves all available height except that floor.
- **Verified:** The horizontal path continues to return `LegendType.Plain`; no
  Plain-to-Scroll fallback was added.
- **Verified:**
  `superset-frontend/plugins/plugin-chart-echarts/test/utils/series.test.ts` adds
  a 40-item, 800-by-400 regression case whose estimated eleven rows require a
  260px margin, and updates the small-chart overflow expectation to preserve an
  80px plot area.
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

## Prevention

- **Verified:** The new regression test ties the reserved horizontal margin to
  the estimator's complete row count at realistic chart dimensions while also
  asserting that the user-selected Plain type is preserved.
- **Inferred:** Future legend layout changes should test the selected legend
  type, the estimated item capacity, and the resulting grid margin together,
  including a case that crosses any plot-preservation boundary.
