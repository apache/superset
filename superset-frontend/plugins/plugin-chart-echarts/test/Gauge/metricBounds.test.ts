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
import buildQuery from '../../src/Gauge/buildQuery';
import transformProps from '../../src/Gauge/transformProps';
import { EchartsGaugeChartProps } from '../../src/Gauge/types';

const formData: SqlaFormData = {
  datasource: '26__table',
  viz_type: VizType.Gauge,
  metric: 'sales',
  groupby: [],
  colorScheme: 'SUPERSET_DEFAULT',
};

const gaugeSeries = (
  overrides: Partial<SqlaFormData>,
  data: Record<string, unknown>[],
) =>
  (
    transformProps(
      new ChartProps({
        formData: { ...formData, ...overrides },
        width: 800,
        height: 600,
        queriesData: [{ data }],
        theme: supersetTheme,
      }) as EchartsGaugeChartProps,
    ).echartOptions as any
  ).series[0];

test('buildQuery queries the bound metrics alongside the value', () => {
  const [query] = buildQuery({
    ...formData,
    min_metric: 'floor',
    max_metric: 'quota',
  }).queries;
  expect(query.metrics).toEqual(['sales', 'floor', 'quota']);
});

test('buildQuery queries a bound metric that equals the value only once', () => {
  const [query] = buildQuery({ ...formData, max_metric: 'sales' }).queries;
  expect(query.metrics).toEqual(['sales']);
});

test('the max metric overrides the typed max', () => {
  const series = gaugeSeries({ maxVal: 100, maxMetric: 'quota' }, [
    { sales: 72000, quota: 90000 },
  ]);
  expect(series.max).toBe(90000);
});

test('the typed max applies when the max metric returns no value', () => {
  const series = gaugeSeries({ maxVal: 100000, maxMetric: 'quota' }, [
    { sales: 72000, quota: null },
  ]);
  expect(series.max).toBe(100000);
});

test('grouped gauges share the widest bounds across groups', () => {
  const series = gaugeSeries(
    { groupby: ['region'], minMetric: 'floor', maxMetric: 'quota' },
    [
      { region: 'West', sales: 84, floor: 10, quota: 90 },
      { region: 'East', sales: 70, floor: 5, quota: 75 },
    ],
  );
  expect(series.min).toBe(5);
  expect(series.max).toBe(90);
});

test('a max metric at or below the min still yields a usable axis', () => {
  const series = gaugeSeries({ minVal: 0, maxMetric: 'quota' }, [
    { sales: 5, quota: 0 },
  ]);
  expect(series.max).toBeGreaterThan(series.min);
});

test('relative interval bounds are read as percentages of the axis', () => {
  const series = gaugeSeries(
    {
      maxMetric: 'quota',
      intervals: '50,100',
      intervalColorIndices: '1,2',
      intervalsRelative: true,
    },
    [{ sales: 72000, quota: 90000 }],
  );
  expect(series.axisLine.lineStyle.color.map((c: any[]) => c[0])).toEqual([
    0.5, 1,
  ]);
});
