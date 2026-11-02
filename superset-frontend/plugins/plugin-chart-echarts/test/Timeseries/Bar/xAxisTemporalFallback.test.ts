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
import type { XAxisComponentOption } from 'echarts';
import transformProps from '../../../src/Timeseries/transformProps';
import { DEFAULT_FORM_DATA } from '../../../src/Timeseries/constants';
import { EchartsTimeseriesSeriesType } from '../../../src/Timeseries/types';
import { EchartsTimeseriesChartProps } from '../../../src/types';

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

describe('bar chart x-axis: raw epoch values are not mislabeled when coltypes does not mark the column Temporal', () => {
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
