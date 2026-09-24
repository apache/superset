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
import { ChartProps, SqlaFormData } from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/common';
import { supersetTheme } from '@apache-superset/core/theme';
import type { BarSeriesOption } from 'echarts/charts';
import transformProps from '../../../src/Timeseries/transformProps';
import { DEFAULT_FORM_DATA } from '../../../src/Timeseries/constants';
import { EchartsTimeseriesSeriesType } from '../../../src/Timeseries/types';
import { EchartsTimeseriesChartProps } from '../../../src/types';
import { getXAxisDomain } from '../../../src/utils/formatters';
import { TIMESERIES_CONSTANTS } from '../../../src/constants';

// Only two of the 24 hourly buckets in the day have data, mirroring the
// ticket's "data for only a small portion of the range" sub-daily scenario
// (e.g. "one hour out of a 24-hour window"). Two points (rather than one)
// keep the axis domain well-defined so the expected per-bucket pixel width
// below can be computed without depending on ECharts' own single-point
// extent-padding heuristics.
const SPARSE_TIMESTAMPS = [
  Date.UTC(2024, 0, 1, 1, 0, 0),
  Date.UTC(2024, 0, 1, 23, 0, 0),
];
const HOUR_GRAIN_MS = 3_600_000; // TIMEGRAIN_TO_TIMESTAMP['PT1H']

function buildSparseHourlyBarOptions(width: number) {
  const formData: SqlaFormData = {
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

  const chartProps = new ChartProps({
    width,
    height: 400,
    queriesData: [
      {
        data: SPARSE_TIMESTAMPS.map(__timestamp => ({
          count: 1,
          __timestamp,
        })),
        colnames: ['count', '__timestamp'],
        coltypes: [GenericDataType.Numeric, GenericDataType.Temporal],
      },
    ],
    formData,
    theme: supersetTheme,
  });

  return transformProps(chartProps as EchartsTimeseriesChartProps)
    .echartOptions;
}

test('a sparse hourly bucket does not render several grain-widths wider than its own bucket', () => {
  const width = 800;
  const { series } = buildSparseHourlyBarOptions(width);
  const [barSeries] = series as BarSeriesOption[];

  // Same domain-estimation helper the axis-label spacing logic already uses
  // (utils/formatters.ts getXAxisDomain) and the same plot-width estimate
  // used there (chart width minus the fixed left grid offset), so the
  // expectation is derived from the codebase's own model of the visible
  // axis span rather than from assumptions about ECharts' internals.
  const [domainMin, domainMax] = getXAxisDomain(
    [SPARSE_TIMESTAMPS.map(__timestamp => ({ __timestamp }))],
    '__timestamp',
  );
  const plotWidthPx = Math.max(
    width - 2 * TIMESERIES_CONSTANTS.gridOffsetLeft,
    0,
  );
  const domainSpanMs = (domainMax as number) - (domainMin as number);
  const correctGrainPxWidth = (HOUR_GRAIN_MS / domainSpanMs) * plotWidthPx;

  const effectiveBarPxWidth =
    (barSeries.barWidth as number | undefined) ??
    (barSeries.barMaxWidth as number | undefined);

  // A bar for one hourly bucket should stay close to that bucket's own
  // pixel width on the axis, not balloon out to cover several neighboring
  // (unpopulated) hours. Allow generous slack (2x) for padding/centering,
  // rather than pinning an exact pixel value.
  expect(effectiveBarPxWidth).toBeLessThanOrEqual(correctGrainPxWidth * 2);
});

test('the bar-width cap scales with the chart pixel width instead of staying a fixed constant', () => {
  const narrow = buildSparseHourlyBarOptions(300);
  const wide = buildSparseHourlyBarOptions(3000);

  const widthOf = (options: ReturnType<typeof buildSparseHourlyBarOptions>) => {
    const [barSeries] = options.series as BarSeriesOption[];
    return (
      (barSeries.barWidth as number | undefined) ??
      (barSeries.barMaxWidth as number | undefined)
    );
  };

  // A chart 10x wider maps the same one-hour bucket to ~10x more pixels, so
  // the bar's pixel-width bound must grow with it. A constant cap (the
  // current behavior) fails this regardless of chart size.
  expect(widthOf(wide)).not.toBe(widthOf(narrow));
});
