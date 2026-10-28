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
  TimeGranularity,
  createSmartDateFormatter,
  getTimeFormatterRegistry,
  SMART_DATE_ID,
} from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/common';
import { supersetTheme } from '@apache-superset/core/theme';
import {
  EchartsSunburstChartProps,
  EchartsSunburstFormData,
} from '../../src/Sunburst/types';
import transformProps from '../../src/Sunburst/transformProps';

type SunburstSeries = {
  label?: Record<string, unknown>;
  data: { value: number }[];
};
// Match the app bootstrap's formatter registration.
beforeAll(() => {
  getTimeFormatterRegistry().registerValue(
    SMART_DATE_ID,
    createSmartDateFormatter(),
  );
});

const firstSeries = (echartOptions: unknown) =>
  (echartOptions as { series: SunburstSeries[] }).series[0];

const formData = {
  colorScheme: 'bnbColors',
  datasource: '3__table',
  groupby: ['category'],
  metric: 'sum__value',
};

const chartProps = new ChartProps({
  formData,
  width: 800,
  height: 600,
  queriesData: [
    {
      data: [
        { category: 'A', sum__value: 10 },
        { category: 'B', sum__value: 20 },
      ],
    },
  ],
  theme: supersetTheme,
});

test('series label has no textBorderColor or textBorderWidth', () => {
  const { echartOptions } = transformProps(
    chartProps as EchartsSunburstChartProps,
  );
  const series = firstSeries(echartOptions);
  expect(series.label).not.toHaveProperty('textBorderColor');
  expect(series.label).not.toHaveProperty('textBorderWidth');
});

const nullValueProps = (showNullValues?: boolean) =>
  new ChartProps({
    formData: {
      colorScheme: 'bnbColors',
      datasource: '3__table',
      columns: ['category'],
      metric: 'sum__value',
      ...(showNullValues === undefined ? {} : { showNullValues }),
    },
    width: 800,
    height: 600,
    queriesData: [
      {
        data: [
          { category: 'A', sum__value: 10 },
          { category: 'B', sum__value: 20 },
          { category: null, sum__value: 5 },
        ],
      },
    ],
    theme: supersetTheme,
  });

const seriesValues = (props: ChartProps) => {
  const { echartOptions } = transformProps(props as EchartsSunburstChartProps);
  return firstSeries(echartOptions)
    .data.map(node => node.value)
    .sort((a, b) => a - b);
};

// Charts saved before the "Show Null Values" control existed have no
// `showNullValues` in form data; they must keep showing nulls (non-breaking).
test('keeps null values when showNullValues is unset (legacy charts)', () => {
  expect(seriesValues(nullValueProps(undefined))).toEqual([5, 10, 20]);
});

test('keeps null values when showNullValues is true', () => {
  expect(seriesValues(nullValueProps(true))).toEqual([5, 10, 20]);
});

// Single-column sunburst: the toggle must actually drop the null node.
test('removes null values when showNullValues is false', () => {
  expect(seriesValues(nullValueProps(false))).toEqual([10, 20]);
});

test.each([
  TimeGranularity.MONTH,
  TimeGranularity.QUARTER,
  TimeGranularity.YEAR,
])('smart_date labels distinguish %s buckets across years', grain => {
  const month = grain === TimeGranularity.YEAR ? 0 : 9;
  const props = new ChartProps<EchartsSunburstFormData>({
    formData: {
      ...formData,
      viz_type: 'sunburst_v2',
      columns: ['order_date'],
      dateFormat: 'smart_date',
      timeGrainSqla: grain,
      granularitySqla: 'order_date',
    },
    width: 800,
    height: 600,
    theme: supersetTheme,
    queriesData: [
      {
        colnames: ['order_date', 'sum__value'],
        coltypes: [GenericDataType.Temporal, GenericDataType.Numeric],
        data: [
          { order_date: Date.UTC(2023, month, 1), sum__value: 10 },
          { order_date: Date.UTC(2024, month, 1), sum__value: 20 },
        ],
      },
    ],
  });
  const result = transformProps(props as EchartsSunburstChartProps);
  const nodes = (
    result.echartOptions as {
      series: { data: { name: string; records: number[] }[] }[];
    }
  ).series[0].data;
  expect(nodes[0].name).toContain('2023');
  expect(nodes[1].name).toContain('2024');
  expect(nodes[0].name).not.toBe(nodes[1].name);
  expect(nodes.map(node => node.records[0])).toEqual([
    Date.UTC(2023, month, 1),
    Date.UTC(2024, month, 1),
  ]);
});

test.each([
  [TimeGranularity.WEEK, Date.UTC(2024, 9, 7), 'Mon 07'],
  [TimeGranularity.DAY, Date.UTC(2024, 9, 7), 'Mon 07'],
  [TimeGranularity.HOUR, Date.UTC(2024, 9, 7, 6), '06 AM'],
])('keeps compact smart_date labels for %s', (grain, raw, label) => {
  const props = new ChartProps<EchartsSunburstFormData>({
    formData: {
      ...formData,
      viz_type: 'sunburst_v2',
      columns: ['order_date'],
      dateFormat: 'smart_date',
      timeGrainSqla: grain,
      granularitySqla: 'order_date',
    },
    width: 800,
    height: 600,
    theme: supersetTheme,
    queriesData: [
      {
        colnames: ['order_date', 'sum__value'],
        coltypes: [GenericDataType.Temporal, GenericDataType.Numeric],
        data: [{ order_date: raw, sum__value: 10 }],
      },
    ],
  });
  const result = transformProps(props as EchartsSunburstChartProps);
  expect(
    (result.echartOptions as { series: { data: { name: string }[] }[] })
      .series[0].data[0].name,
  ).toBe(label);
});

test('a year label is not highlighted by digits inside a selected epoch key', () => {
  const y2000 = Date.UTC(2000, 0, 1);
  const y2004 = Date.UTC(2004, 0, 1);
  // The selected key holds 1072915200000, which contains the digits "2000".
  expect(String(y2004)).toContain('2000');
  const props = new ChartProps<EchartsSunburstFormData>({
    formData: {
      ...formData,
      viz_type: 'sunburst_v2',
      columns: ['order_date', 'category'],
      dateFormat: 'smart_date',
      timeGrainSqla: TimeGranularity.YEAR,
      granularitySqla: 'order_date',
    },
    width: 800,
    height: 600,
    theme: supersetTheme,
    filterState: { selectedValues: [`${y2004},A`] },
    queriesData: [
      {
        colnames: ['order_date', 'category', 'sum__value'],
        coltypes: [
          GenericDataType.Temporal,
          GenericDataType.String,
          GenericDataType.Numeric,
        ],
        data: [
          { order_date: y2000, category: 'A', sum__value: 10 },
          { order_date: y2004, category: 'A', sum__value: 20 },
        ],
      },
    ],
  });
  const nodes = (
    transformProps(props as EchartsSunburstChartProps).echartOptions as {
      series: {
        data: {
          name: string;
          itemStyle?: { opacity?: number };
          children?: { itemStyle?: { opacity?: number } }[];
        }[];
      }[];
    }
  ).series[0].data;
  expect(nodes.map(node => node.name)).toEqual(['2000', '2004']);
  expect(nodes[0].itemStyle?.opacity).toBe(0.3);
  expect(nodes[0].children?.[0].itemStyle?.opacity).toBe(0.3);
  expect(nodes[1].itemStyle?.opacity).toBeUndefined();
  expect(nodes[1].children?.[0].itemStyle?.opacity).toBeUndefined();
});

test.each([undefined, 'created_at'])(
  'formats both lookup-grained temporal levels with Time Column %s',
  timeColumn => {
    const props = new ChartProps<EchartsSunburstFormData>({
      formData: {
        ...formData,
        viz_type: 'sunburst_v2',
        columns: ['order_date', 'ship_date'],
        temporalColumnsLookup: { order_date: true, ship_date: true },
        timeGrainSqla: TimeGranularity.MONTH,
        extraFormData: { granularity_sqla: timeColumn },
        dateFormat: SMART_DATE_ID,
      },
      width: 800,
      height: 600,
      theme: supersetTheme,
      queriesData: [
        {
          colnames: ['order_date', 'ship_date', 'sum__value'],
          coltypes: [
            GenericDataType.Temporal,
            GenericDataType.Temporal,
            GenericDataType.Numeric,
          ],
          data: [
            {
              order_date: Date.UTC(2024, 9, 1),
              ship_date: Date.UTC(2024, 10, 1),
              sum__value: 10,
            },
          ],
        },
      ],
    });
    const result = transformProps(props as EchartsSunburstChartProps);
    const nodes = (
      result.echartOptions as {
        series: { data: { name: string; children: { name: string }[] }[] }[];
      }
    ).series[0].data;
    expect(nodes[0].name).toBe('Oct 2024');
    expect(nodes[0].children[0].name).toBe('Nov 2024');
  },
);
