/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import {
  ChartProps,
  ChartDataResponseResult,
  Column,
  SqlaFormData,
} from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/common';
import { supersetTheme } from '@apache-superset/core/theme';
import type { BarSeriesOption } from 'echarts/charts';
import type { XAxisComponentOption } from 'echarts';
import transformProps from '../../../src/Timeseries/transformProps';
import { DEFAULT_FORM_DATA } from '../../../src/Timeseries/constants';
import { EchartsTimeseriesSeriesType } from '../../../src/Timeseries/types';
import { EchartsTimeseriesChartProps } from '../../../src/types';
import { getXAxisDomain } from '../../../src/utils/formatters';
import { TIMESERIES_CONSTANTS } from '../../../src/constants';

const HOUR_GRAIN_MS = 3_600_000; // TIMEGRAIN_TO_TIMESTAMP['PT1H']

// The dataset's own definition of `__timestamp` as the designated temporal
// column — independent of any given query response's (possibly malformed)
// `coltypes` — matching the shape the fix now cross-references.
const DEFAULT_DATASOURCE_COLUMNS: Column[] = [
  {
    column_name: 'count',
    is_dttm: false,
    type_generic: GenericDataType.Numeric,
  },
  {
    column_name: '__timestamp',
    is_dttm: true,
    type_generic: GenericDataType.Temporal,
  },
];

const BASE_FORM_DATA: SqlaFormData = {
  ...DEFAULT_FORM_DATA,
  colorScheme: 'bnbColors',
  datasource: '3__table',
  granularity_sqla: '__timestamp',
  time_grain_sqla: 'PT1H',
  metric: ['count'],
  groupby: [],
  viz_type: 'echarts_timeseries_bar',
  seriesType: EchartsTimeseriesSeriesType.Bar,
  orientation: 'vertical',
};

function buildOptions(
  width: number,
  data: Record<string, unknown>[],
  overrides: Partial<ChartDataResponseResult> = {},
  formDataOverrides: Partial<SqlaFormData> = {},
  height = 400,
  datasourceColumns: Column[] = DEFAULT_DATASOURCE_COLUMNS,
) {
  const chartProps = new ChartProps({
    width,
    height,
    queriesData: [
      {
        data,
        colnames: ['count', '__timestamp'],
        coltypes: [GenericDataType.Numeric, GenericDataType.Temporal],
        ...overrides,
      },
    ],
    formData: { ...BASE_FORM_DATA, ...formDataOverrides },
    theme: supersetTheme,
    datasource: { columns: datasourceColumns },
  });

  return transformProps(chartProps as EchartsTimeseriesChartProps)
    .echartOptions;
}

// A bare `as XAxisComponentOption` cast is not real narrowing — a malformed
// or missing xAxis option would silently produce `undefined` and let a
// `.not.toBe('time')` assertion pass for the wrong reason. Validate the
// minimal shape first so a broken option object fails loudly instead.
function xAxisType(xAxis: unknown): unknown {
  if (
    typeof xAxis !== 'object' ||
    xAxis === null ||
    Array.isArray(xAxis) ||
    !('type' in xAxis)
  ) {
    throw new Error(
      `expected a single xAxis option object with a "type" property, got: ${JSON.stringify(xAxis)}`,
    );
  }
  return (xAxis as XAxisComponentOption).type;
}

// ECharts applies barMinWidth/barMaxWidth as a hard ceiling/floor on top of
// whatever barWidth (explicit or auto-computed) would otherwise be used —
// "as CSS does" (node_modules/echarts/lib/layout/barGrid.js, calcBarWidthAndOffset:
// `finalWidth = mathMin(finalWidth, maxWidth)` runs whether or not barWidth
// was already set). So the pixel width ECharts will actually render is the
// minimum of whichever of barWidth/barMaxWidth Superset sets — not "prefer
// barWidth if present" — otherwise a fix that adds a grain-derived barWidth
// but leaves the existing flat barMaxWidth in place could pass this guard
// while the chart still renders the old, capped width.
function effectiveBarPxWidth(series: BarSeriesOption) {
  const candidates = [series.barWidth, series.barMaxWidth].filter(
    (v): v is number => typeof v === 'number',
  );
  return candidates.length ? Math.min(...candidates) : undefined;
}

test('a sparse hourly bucket (two sparse points) does not render several grain-widths wider than its own bucket', () => {
  const width = 800;
  // Only two of the 24 hourly buckets in the day have data, mirroring the
  // ticket's "data for only a small portion of the range" sub-daily
  // scenario. Two points (rather than one) keep the *data* extent
  // well-defined so the expected per-bucket pixel width below can be
  // computed from utils/formatters.ts's own getXAxisDomain helper without
  // depending on ECharts' single-point extent-padding heuristics (see the
  // separate single-point test below for that case, which getXAxisDomain
  // cannot express — domainMin === domainMax there).
  const sparseTimestamps = [
    Date.UTC(2024, 0, 1, 1, 0, 0),
    Date.UTC(2024, 0, 1, 23, 0, 0),
  ];
  const { series } = buildOptions(
    width,
    sparseTimestamps.map(__timestamp => ({ count: 1, __timestamp })),
  );
  const [barSeries] = series as BarSeriesOption[];

  const [domainMin, domainMax] = getXAxisDomain(
    [sparseTimestamps.map(__timestamp => ({ __timestamp }))],
    '__timestamp',
  );
  // No legend/title chrome in this fixture, so the plot area matches the
  // TIMESERIES_CONSTANTS.gridOffsetLeft-only estimate; the padded-chart
  // case below (with a left legend) checks the real-padding-aware path.
  const plotWidthPx = Math.max(
    width - 2 * TIMESERIES_CONSTANTS.gridOffsetLeft,
    0,
  );
  const domainSpanMs = (domainMax as number) - (domainMin as number);
  const correctGrainPxWidth = (HOUR_GRAIN_MS / domainSpanMs) * plotWidthPx;

  // A bar for one hourly bucket should stay close to that bucket's own
  // pixel width on the axis, not balloon out to cover several neighboring
  // (unpopulated) hours. Allow generous slack (2x) for padding/centering,
  // rather than pinning an exact pixel value.
  expect(effectiveBarPxWidth(barSeries)).toBeLessThanOrEqual(
    correctGrainPxWidth * 2,
  );
});

test('a single sparse hourly bucket (the ticket\'s literal "one hour out of a 24-hour window" case) does not render several grain-widths wider than its own bucket', () => {
  // getXAxisDomain (data-extent based) is undefined for exactly one point —
  // domainMin === domainMax there, so it can't supply a "visible span" to
  // derive a correct pixel width from on its own. Rather than introducing a
  // new mechanism for what the visible axis span should be (e.g. reading
  // the query response's from_dttm/to_dttm, which transformProps.ts does
  // not otherwise consult), this pins the correct width against ECharts'
  // own actual, already-existing default for a degenerate single-point time
  // axis: verified via a real ECharts SSR/SVG render (`echarts.init(null,
  // null, { renderer: 'svg', ssr: true })`, then reading
  // `chart.getModel().getComponent('xAxis').axis.scale.getExtent()`) that a
  // lone point on a `type: 'time'` axis with no explicit min/max renders
  // with a 48-hour (2 * ONE_DAY) extent centered on the point — reproduced
  // for PT1H, PT15M, and P1D grains alike (i.e. the padding is fixed and
  // grain-independent). This matches reading ECharts' own source directly:
  // `calcNiceForTimeScale` in echarts/lib/scale/Time.js pads a degenerate
  // extent (`extent[0] === extent[1]`) by exactly `ONE_DAY` on each side.
  const width = 800;
  const singleTimestamp = Date.UTC(2024, 0, 1, 13, 0, 0);

  const { series } = buildOptions(width, [
    { count: 1, __timestamp: singleTimestamp },
  ]);
  const [barSeries] = series as BarSeriesOption[];

  const plotWidthPx = Math.max(
    width - 2 * TIMESERIES_CONSTANTS.gridOffsetLeft,
    0,
  );
  const verifiedSinglePointDomainSpanMs = 2 * 24 * 60 * 60 * 1000; // 48h
  const correctGrainPxWidth =
    (HOUR_GRAIN_MS / verifiedSinglePointDomainSpanMs) * plotWidthPx;

  expect(effectiveBarPxWidth(barSeries)).toBeLessThanOrEqual(
    correctGrainPxWidth * 2,
  );
});

test('the effective bar-width constraint scales with chart pixel width instead of staying a fixed constant', () => {
  const sparseTimestamps = [
    Date.UTC(2024, 0, 1, 1, 0, 0),
    Date.UTC(2024, 0, 1, 23, 0, 0),
  ];
  const data = sparseTimestamps.map(__timestamp => ({ count: 1, __timestamp }));
  const [domainMin, domainMax] = getXAxisDomain(
    [sparseTimestamps.map(__timestamp => ({ __timestamp }))],
    '__timestamp',
  );
  const domainSpanMs = (domainMax as number) - (domainMin as number);

  const check = (width: number) => {
    const { series } = buildOptions(width, data);
    const [barSeries] = series as BarSeriesOption[];
    const plotWidthPx = Math.max(
      width - 2 * TIMESERIES_CONSTANTS.gridOffsetLeft,
      0,
    );
    const correctGrainPxWidth = (HOUR_GRAIN_MS / domainSpanMs) * plotWidthPx;
    return { effective: effectiveBarPxWidth(barSeries), correctGrainPxWidth };
  };

  const narrow = check(300);
  const wide = check(3000);

  // A chart 10x wider maps the same one-hour bucket to ~10x more pixels, so
  // the effective bar-width constraint must grow with it — a flat constant
  // (today's behavior) fails this regardless of chart size, and so would a
  // fix that adds a grain-derived barWidth but leaves the old flat
  // barMaxWidth in place, since effectiveBarPxWidth takes the ECharts-real
  // min() of both fields rather than just reading whichever is set.
  expect(narrow.effective).not.toBe(wide.effective);
  expect(narrow.effective).toBeLessThanOrEqual(narrow.correctGrainPxWidth * 2);
  expect(wide.effective).toBeLessThanOrEqual(wide.correctGrainPxWidth * 2);
});

test('horizontal orientation: bar width is sized against chart height, not width, since the temporal axis renders along height there', () => {
  // In horizontal orientation, Timeseries/transformProps.ts swaps the built
  // xAxis/yAxis option objects (`[xAxis, yAxis] = [yAxis, xAxis]`), so the
  // temporal axis ends up on the chart's *vertical* dimension. A fix that
  // still divided the grain by `width` there would compute a cap many
  // times too loose (confirmed independently via an ECharts SSR render: a
  // 3000x400 horizontal chart with hourly points 22h apart renders an
  // actual bar around ~124px, one hour is genuinely ~16px, but dividing by
  // `width` alone there yields a ~8x-too-generous cap). Pick a narrow
  // width and a tall height so the two dimensions would produce very
  // different caps, to decisively catch a width/height mixup either way.
  const width = 400;
  const height = 3000;
  const sparseTimestamps = [
    Date.UTC(2024, 0, 1, 1, 0, 0),
    Date.UTC(2024, 0, 1, 23, 0, 0),
  ];
  const { series } = buildOptions(
    width,
    sparseTimestamps.map(__timestamp => ({ count: 1, __timestamp })),
    {},
    { orientation: 'horizontal' },
    height,
  );
  const [barSeries] = series as BarSeriesOption[];

  const [domainMin, domainMax] = getXAxisDomain(
    [sparseTimestamps.map(__timestamp => ({ __timestamp }))],
    '__timestamp',
  );
  const domainSpanMs = (domainMax as number) - (domainMin as number);
  const plotHeightPx = Math.max(
    height -
      TIMESERIES_CONSTANTS.gridOffsetTop -
      TIMESERIES_CONSTANTS.gridOffsetBottom,
    0,
  );
  const correctGrainPxWidth = (HOUR_GRAIN_MS / domainSpanMs) * plotHeightPx;
  // The (wrong) width-based value a `width`-only computation would have
  // produced, to assert the fix isn't accidentally still using it.
  const wrongWidthBasedPxWidth =
    (HOUR_GRAIN_MS / domainSpanMs) *
    Math.max(width - 2 * TIMESERIES_CONSTANTS.gridOffsetLeft, 0);

  const effective = effectiveBarPxWidth(barSeries);
  expect(effective).toBeLessThanOrEqual(correctGrainPxWidth * 2);
  expect(effective).toBeGreaterThan(wrongWidthBasedPxWidth * 2);
});

test('a chart with heavily-reserved grid space (a left legend on a narrow chart) sizes the bar against the real plot area, not width alone', () => {
  // The grain-to-pixel computation must derive the plot length from this
  // codebase's own real grid-padding computation (getPadding, reused via
  // the `padding` object Timeseries/transformProps.ts already builds for
  // the chart's actual grid), not a flat per-side constant — a narrow
  // chart with a left-side legend genuinely has far less plot width than
  // `width` alone suggests, confirmed independently via an ECharts SSR
  // render (a 250px-wide chart with a left legend rendered a real bar
  // around ~5.24px while one hourly bucket actually occupied ~0.69px; a
  // fix using a flat gridOffsetLeft guess instead of the real legend-aware
  // padding would compute a cap many times too loose there).
  const width = 250;
  const sparseTimestamps = [
    Date.UTC(2024, 0, 1, 1, 0, 0),
    Date.UTC(2024, 0, 1, 23, 0, 0),
  ];
  const { series, grid } = buildOptions(
    width,
    sparseTimestamps.map(__timestamp => ({ count: 1, __timestamp })),
    {},
    {
      showLegend: true,
      legendOrientation: 'left',
      groupby: ['count'],
    },
  );
  const [barSeries] = series as BarSeriesOption[];
  const gridBox = grid as { left?: number; right?: number };

  const [domainMin, domainMax] = getXAxisDomain(
    [sparseTimestamps.map(__timestamp => ({ __timestamp }))],
    '__timestamp',
  );
  const domainSpanMs = (domainMax as number) - (domainMin as number);
  // Sanity check that the fixture actually reserves meaningful legend
  // space, so this test can't pass vacuously if the legend didn't render.
  const realPlotWidthPx = Math.max(
    width - (gridBox.left ?? 0) - (gridBox.right ?? 0),
    0,
  );
  expect(realPlotWidthPx).toBeLessThan(
    width - 2 * TIMESERIES_CONSTANTS.gridOffsetLeft,
  );

  const correctGrainPxWidth = (HOUR_GRAIN_MS / domainSpanMs) * realPlotWidthPx;
  // The value a flat-gridOffsetLeft (legend-blind) computation would have
  // produced, to assert the fix isn't still using that estimate.
  const flatOffsetPxWidth =
    (HOUR_GRAIN_MS / domainSpanMs) *
    Math.max(width - 2 * TIMESERIES_CONSTANTS.gridOffsetLeft, 0);

  const effective = effectiveBarPxWidth(barSeries);
  expect(effective).toBeLessThanOrEqual(correctGrainPxWidth * 2);
  expect(effective).toBeLessThan(flatOffsetPxWidth);
});

describe('sparse sub-daily bar chart: x-axis mislabels raw epoch values when coltypes does not mark the column Temporal', () => {
  // getColtypesMapping (utils/series.ts) builds xAxisDataType purely from
  // colnames[i] -> coltypes[i]; if that lookup doesn't resolve to
  // GenericDataType.Temporal (=2) for the x-axis column, getAxisType
  // (utils/series.ts) falls back to AxisType.Category instead of
  // AxisType.Time, and the axis formatter falls back to the plain `String`/
  // `getNumberFormatter` path (Timeseries/transformProps.ts) instead of the
  // grain-aware smart-date formatter — so whatever raw value is in the
  // series data (the millisecond timestamp) renders verbatim. This is a
  // second, independent mechanism from the bar-geometry tests above: it
  // reproduces the "x-axis shows raw epoch/unix timestamps" half of the
  // ticket even when the bar-width bug above is fixed.
  const sparseTimestamps = [
    Date.UTC(2024, 0, 1, 1, 0, 0),
    Date.UTC(2024, 0, 1, 23, 0, 0),
  ];
  const data = sparseTimestamps.map(__timestamp => ({ count: 1, __timestamp }));

  // The decisive invariant across both mismatch shapes below: a genuinely
  // temporal x-axis column (per the dataset's own `is_dttm`/`type_generic`
  // metadata in datasource.columns — the ticket's actual bug shape: the
  // dataset says the column is temporal, but this particular query
  // response's coltypes is malformed) whose coltype lookup gave no usable
  // classification at all (missing entry, or a raw SQL-type string that
  // isn't a GenericDataType member) must still resolve to a `time` axis.
  test('coltypes shorter than colnames (temporal entry missing)', () => {
    const { xAxis } = buildOptions(800, data, {
      coltypes: [GenericDataType.Numeric],
    });
    expect(xAxisType(xAxis)).toBe('time');
  });

  test('coltypes as raw SQL type strings (matches the shape already used by Bar/transformProps.test.ts\'s own fixtures, e.g. "TIMESTAMP")', () => {
    const { xAxis } = buildOptions(800, data, {
      coltypes: ['BIGINT', 'TIMESTAMP'] as unknown as GenericDataType[],
    });
    expect(xAxisType(xAxis)).toBe('time');
  });

  // A separate, genuinely numeric column (distinct name and values from
  // the temporal fixtures above) as the designated x-axis, whose own
  // dataset column metadata correctly says it's Numeric — with an
  // unrelated dashboard-level time-grain cross-filter (a real, supported
  // Superset feature: such a filter can apply to every chart on a
  // dashboard, including ones whose x-axis has nothing to do with time)
  // still resolved for this chart. Coercing here would wrongly turn this
  // unrelated numeric chart into a time axis, so it must not — this is the
  // scenario the datasource-column cross-reference exists to rule out.
  //
  // The query response's own coltype for `price` is deliberately
  // *unusable* here (a raw SQL-type string, not a GenericDataType member)
  // rather than a valid `Numeric` classification: with a usable coltype,
  // `rawXAxisDataTypeIsUsable` is already `true` and the function returns
  // early without ever reaching the datasource-metadata lookup at all — a
  // test built that way would pass identically against the code from
  // before the metadata fix existed, providing no actual regression
  // protection for it. An unusable coltype forces the function through the
  // same "no usable classification, fall back to *something*" branch the
  // ticket's real bug takes, so the assertion only passes if the
  // datasource lookup itself correctly says `price` isn't temporal.
  test('a genuinely numeric x-axis (price) stays non-Temporal even with an unusable coltype and an unrelated dashboard time-grain filter', () => {
    const priceDatasourceColumns: Column[] = [
      {
        column_name: 'price',
        is_dttm: false,
        type_generic: GenericDataType.Numeric,
      },
      // The dataset has its own, unrelated temporal column — present to
      // make the fixture realistic (a dataset with a numeric x-axis chart
      // can still have datetime columns other charts/filters use), not
      // referenced by this chart's own x-axis.
      {
        column_name: 'order_date',
        is_dttm: true,
        type_generic: GenericDataType.Temporal,
      },
    ];
    const { xAxis } = buildOptions(
      800,
      [
        { count: 1, price: 10 },
        { count: 1, price: 20 },
      ],
      {
        colnames: ['count', 'price'],
        coltypes: ['BIGINT'] as unknown as GenericDataType[], // unusable: missing entry
      },
      {
        x_axis: 'price',
        granularity_sqla: 'order_date',
        // Simulates a dashboard-level cross-filter setting a grain that
        // has nothing to do with this chart's own (non-temporal) x-axis.
        extraFormData: { time_grain_sqla: 'PT1H' },
      },
      400,
      priceDatasourceColumns,
    );
    // Exact type, not just `.not.toBe('time')`: with seriesType Bar and a
    // non-Temporal classification, getAxisType (utils/series.ts) always
    // falls through to Category — asserting the real fallback value avoids
    // an assertion that would also pass for an axis option that's merely
    // missing its `type` altogether.
    expect(xAxisType(xAxis)).toBe('category');
  });

  // An ad-hoc (computed/expression, not physical) x_axis is still "the
  // selected axis" per getXAxisColumn's own precedence (isXAxisSet =
  // isQueryFormColumn(x_axis), true for either a physical or a valid
  // ad-hoc column) — granularity_sqla is only ever a fallback for when
  // x_axis isn't set at all. A chart with an ad-hoc, genuinely non-temporal
  // x-axis (`double_price`) must not have its axis type decided by an
  // unrelated, genuinely temporal `granularity_sqla` column's metadata,
  // even though `double_price` itself has no datasource.columns entry to
  // confirm it either way (it's a computed expression, not a physical
  // column).
  test("an ad-hoc, non-physical x-axis does not fall back to granularity_sqla's (unrelated) column metadata", () => {
    const { xAxis } = buildOptions(
      800,
      [
        { count: 1, double_price: 10 },
        { count: 1, double_price: 20 },
      ],
      {
        colnames: ['count', 'double_price'],
        coltypes: [GenericDataType.Numeric], // unusable: missing entry for double_price
      },
      {
        x_axis: {
          label: 'double_price',
          sqlExpression: 'price * 2',
          expressionType: 'SQL',
        } as unknown as string,
        granularity_sqla: 'order_date',
        extraFormData: { time_grain_sqla: 'PT1H' },
      },
      400,
      [
        {
          column_name: 'count',
          is_dttm: false,
          type_generic: GenericDataType.Numeric,
        },
        // Real, genuinely temporal column — present on the dataset, but
        // not what this chart's x-axis actually is.
        {
          column_name: 'order_date',
          is_dttm: true,
          type_generic: GenericDataType.Temporal,
        },
      ],
    );
    expect(xAxisType(xAxis)).toBe('category');
  });
});
