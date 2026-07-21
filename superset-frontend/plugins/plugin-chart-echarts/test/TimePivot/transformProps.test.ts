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
import transformProps from '../../src/TimePivot/transformProps';
import { EchartsTimePivotChartProps } from '../../src/TimePivot/types';

const WEEK = 7 * 24 * 3600 * 1000;
// Mondays (UTC): 2020-01-06 and 2020-01-13
const MONDAY_1 = 1578268800000;
const MONDAY_2 = MONDAY_1 + WEEK;

const formData: SqlaFormData = {
  datasource: '5__table',
  viz_type: VizType.TimePivot,
  metric: 'sum__num',
  freq: 'W-MON',
  colorPicker: { r: 0, g: 122, b: 135, a: 1 },
};

const chartProps = (overrides: Partial<SqlaFormData> = {}) =>
  new ChartProps({
    width: 800,
    height: 400,
    formData: { ...formData, ...overrides },
    theme: supersetTheme,
    queriesData: [
      {
        data: [
          { __timestamp: MONDAY_1, sum__num: 10 },
          { __timestamp: MONDAY_2, sum__num: 20 },
        ],
      },
    ],
    hooks: {},
  }) as unknown as EchartsTimePivotChartProps;

test('pivots periods into one line series each, current on top', () => {
  const { echartOptions } = transformProps(chartProps());
  const { series } = echartOptions as any;

  expect(series).toHaveLength(2);
  // drawn prior-first so "current" paints on top
  expect(series.map((s: any) => s.name)).toEqual(['-1', 'current']);

  const current = series[1];
  expect(current.type).toBe('line');
  expect(current.lineStyle.color).toBe('rgba(0, 122, 135, 1)');
  // prior period shifted onto the current period's axis, faded
  const prior = series[0];
  expect(prior.data[0][0]).toBe(MONDAY_2);
  expect(prior.lineStyle.color).toMatch(/rgba\(0, 122, 135, 0\.2/);
});

test('honors log scale and y-axis bounds', () => {
  const { echartOptions } = transformProps(
    chartProps({ yLogScale: true, yAxisBounds: [1, 100] }),
  );
  const { yAxis } = echartOptions as any;
  expect(yAxis.type).toBe('log');
  expect(yAxis.min).toBe(1);
  expect(yAxis.max).toBe(100);
});

test('handles an empty result without crashing', () => {
  const props = new ChartProps({
    width: 800,
    height: 400,
    formData,
    theme: supersetTheme,
    queriesData: [{ data: [] }],
    hooks: {},
  }) as unknown as EchartsTimePivotChartProps;
  const { echartOptions } = transformProps(props);
  expect((echartOptions as any).series).toEqual([]);
});
