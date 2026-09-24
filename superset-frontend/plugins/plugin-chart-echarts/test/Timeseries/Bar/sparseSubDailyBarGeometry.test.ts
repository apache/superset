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
  SqlaFormData,
} from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/common';
import { supersetTheme } from '@apache-superset/core/theme';
import type { BarSeriesOption } from 'echarts/charts';
import transformProps from '../../../src/Timeseries/transformProps';
import { DEFAULT_FORM_DATA } from '../../../src/Timeseries/constants';
import { EchartsTimeseriesSeriesType } from '../../../src/Timeseries/types';
import { EchartsTimeseriesChartProps } from '../../../src/types';
import { getXAxisDomain } from '../../../src/utils/formatters';
import { TIMESERIES_CONSTANTS } from '../../../src/constants';

const HOUR_GRAIN_MS = 3_600_000; // TIMEGRAIN_TO_TIMESTAMP['PT1H']

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
  data: Record<string, number>[],
  overrides: Partial<ChartDataResponseResult> = {},
  formDataOverrides: Partial<SqlaFormData> = {},
) {
  const chartProps = new ChartProps({
    width,
    height: 400,
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
  });

  return transformProps(chartProps as EchartsTimeseriesChartProps)
    .echartOptions;
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
  // domainMin === domainMax there, so it cannot supply a "visible span" to
  // derive a correct pixel width from. The query response's own from_dttm/
  // to_dttm (the actually requested time range, independent of how many
  // rows came back) is the one source in the option-object's inputs that
  // stays well-defined for a single returned row, so this test uses that as
  // the domain instead. Nothing in transformProps.ts currently reads
  // from_dttm/to_dttm (confirmed: no reference to either field in
  // Timeseries/transformProps.ts, utils/series.ts, or utils/formatters.ts)
  // — using it here documents the expectation the fix should meet, not
  // behavior the current code already has.
  const width = 800;
  const fromDttm = Date.UTC(2024, 0, 1, 0, 0, 0);
  const toDttm = Date.UTC(2024, 0, 2, 0, 0, 0); // 24h window
  const singleTimestamp = Date.UTC(2024, 0, 1, 13, 0, 0);

  const { series } = buildOptions(
    width,
    [{ count: 1, __timestamp: singleTimestamp }],
    { from_dttm: fromDttm, to_dttm: toDttm },
  );
  const [barSeries] = series as BarSeriesOption[];

  const plotWidthPx = Math.max(
    width - 2 * TIMESERIES_CONSTANTS.gridOffsetLeft,
    0,
  );
  const correctGrainPxWidth =
    (HOUR_GRAIN_MS / (toDttm - fromDttm)) * plotWidthPx;

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

  // The decisive, uniform invariant across all three mismatch shapes below:
  // a genuinely temporal x-axis column must resolve to a `time` axis. This
  // is checked instead of "the label isn't the raw stringified number"
  // because the mis-typed-as-Numeric case formats through
  // getNumberFormatter instead of String — producing a SMART_NUMBER
  // abbreviation like "1.7T" rather than the literal digit string. That's
  // still wrong (an epoch-derived number, not a date), but it would make a
  // raw-string-equality check a false negative for that one shape; the
  // xAxis.type check catches all three uniformly.
  test('coltypes shorter than colnames (temporal entry missing)', () => {
    const { xAxis } = buildOptions(800, data, {
      coltypes: [GenericDataType.Numeric],
    });
    expect((xAxis as any).type).toBe('time');
  });

  test('coltypes present but the x-axis column is mis-typed as Numeric', () => {
    const { xAxis } = buildOptions(800, data, {
      coltypes: [GenericDataType.Numeric, GenericDataType.Numeric],
    });
    expect((xAxis as any).type).toBe('time');
  });

  test('coltypes as raw SQL type strings (matches the shape already used by Bar/transformProps.test.ts\'s own fixtures, e.g. "TIMESTAMP")', () => {
    const { xAxis } = buildOptions(800, data, {
      coltypes: ['BIGINT', 'TIMESTAMP'] as unknown as GenericDataType[],
    });
    expect((xAxis as any).type).toBe('time');
  });
});
