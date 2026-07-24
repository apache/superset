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
import { ChartProps, SqlaFormData, VizType } from '@superset-ui/core';
import { supersetTheme } from '@apache-superset/core/theme';
import transformProps from '../../src/Rose/transformProps';
import { EchartsRoseChartProps } from '../../src/Rose/types';

const T1 = 1609459200000; // 2021-01-01
const T2 = 1612137600000; // 2021-02-01

const formData: SqlaFormData = {
  datasource: '1__table',
  viz_type: VizType.Rose,
  metrics: ['sum__num'],
  groupby: ['region'],
  numberFormat: 'SMART_NUMBER',
  dateTimeFormat: 'smart_date',
  richTooltip: true,
  roseAreaProportion: false,
};

const records = [
  { __timestamp: T1, 'sum__num, East': 30, 'sum__num, West': 10 },
  { __timestamp: T2, 'sum__num, East': 10, 'sum__num, West': 10 },
];

const chartProps = (overrides: Partial<SqlaFormData> = {}) =>
  new ChartProps({
    width: 800,
    height: 600,
    formData: { ...formData, ...overrides },
    theme: supersetTheme,
    queriesData: [{ data: records }],
    hooks: {},
  }) as unknown as EchartsRoseChartProps;

test('builds one stacked polar bar series per group', () => {
  const { echartOptions, periods, seriesNames } = transformProps(chartProps());
  const { series, angleAxis } = echartOptions as any;

  // series keys drop the metric for grouped single-metric data
  expect(seriesNames).toEqual(['East', 'West']);
  expect(series).toHaveLength(2);
  series.forEach((s: any) => {
    expect(s.type).toBe('bar');
    expect(s.coordinateSystem).toBe('polar');
    expect(s.stack).toBe('rose');
    expect(s.universalTransition).toEqual({ enabled: true });
  });

  // one angular sector per time period, in chronological order
  expect(periods.map((p: any) => p.time)).toEqual([T1, T2]);
  expect(angleAxis.data).toHaveLength(2);

  // radius mode stacks the raw values
  expect(series[0].data.map((d: any) => d.value)).toEqual([30, 10]);
  expect(series[1].data.map((d: any) => d.value)).toEqual([10, 10]);
});

test('area proportion plots sqrt-normalized increments on a unit axis', () => {
  const { echartOptions, periods } = transformProps(
    chartProps({ roseAreaProportion: true }),
  );
  const { series, radiusAxis } = echartOptions as any;

  expect(radiusAxis.max).toBe(1);
  // period 1: outer radii sqrt(30/40), sqrt(40/40); increments are their
  // differences so the stacked outer edge encodes cumulative area
  const sqrt30 = Math.sqrt(30 / 40);
  expect(series[0].data[0].value).toBeCloseTo(sqrt30);
  expect(series[1].data[0].value).toBeCloseTo(1 - sqrt30);
  // the largest-sum period reaches the full unit radius
  const outer = series[0].data[0].value + series[1].data[0].value;
  expect(outer).toBeCloseTo(1);
  expect(periods[0].entries.map((e: any) => e.value)).toEqual([30, 10]);
});

test('rich tooltip lists every series of the hovered period', () => {
  const { echartOptions } = transformProps(chartProps());
  const html = (echartOptions as any).tooltip.formatter({
    dataIndex: 0,
    seriesName: 'East',
  });
  expect(html).toContain('East');
  expect(html).toContain('West');
  expect(html).toContain('30');
  expect(html).toContain('10');
});

test('plain tooltip shows only the hovered series', () => {
  const { echartOptions } = transformProps(chartProps({ richTooltip: false }));
  const html = (echartOptions as any).tooltip.formatter({
    dataIndex: 0,
    seriesName: 'West',
  });
  expect(html).toContain('West');
  expect(html).not.toContain('East');
});

test('sanitizes series names in tooltips', () => {
  const evil = [
    {
      __timestamp: T1,
      'sum__num, <img src=x onerror=alert(1)>': 5,
    },
  ];
  const props = new ChartProps({
    width: 800,
    height: 600,
    formData,
    theme: supersetTheme,
    queriesData: [{ data: evil }],
    hooks: {},
  }) as unknown as EchartsRoseChartProps;
  const { echartOptions } = transformProps(props);
  const html = (echartOptions as any).tooltip.formatter({
    dataIndex: 0,
    seriesName: '<img src=x onerror=alert(1)>',
  });
  expect(html).not.toContain('onerror');
});

test('handles empty results without crashing', () => {
  const props = new ChartProps({
    width: 800,
    height: 600,
    formData,
    theme: supersetTheme,
    queriesData: [{ data: [] }],
    hooks: {},
  }) as unknown as EchartsRoseChartProps;
  const { echartOptions, periods } = transformProps(props);
  expect(periods).toEqual([]);
  expect((echartOptions as any).series).toEqual([]);
});
