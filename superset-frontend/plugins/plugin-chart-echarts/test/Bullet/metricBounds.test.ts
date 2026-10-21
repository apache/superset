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
import buildQuery from '../../src/Bullet/buildQuery';
import transformProps from '../../src/Bullet/transformProps';
import { EchartsBulletChartProps } from '../../src/Bullet/types';

const formData: SqlaFormData = {
  datasource: '5__table',
  viz_type: VizType.Bullet,
  metric: 'sales',
  groupby: ['region'],
};

const rows = [
  { region: 'West', sales: 84, quota: 90 },
  { region: 'East', sales: 70, quota: 60 },
];

const options = (
  overrides: Partial<SqlaFormData>,
  queriesData: { data: Record<string, unknown>[] }[] = [{ data: rows }],
) =>
  transformProps(
    new ChartProps({
      width: 800,
      height: 300,
      formData: { ...formData, ...overrides },
      theme: supersetTheme,
      queriesData,
      hooks: {},
    }) as unknown as EchartsBulletChartProps,
  ).echartOptions as any;

test('buildQuery adds the target metric to the grouped query', () => {
  const { queries } = buildQuery({ ...formData, target_metric: 'quota' });
  expect(queries).toHaveLength(1);
  expect(queries[0].columns).toEqual(['region']);
  expect(queries[0].metrics).toEqual(['sales', 'quota']);
});

test('buildQuery queries a target that equals the measure only once', () => {
  const [query] = buildQuery({ ...formData, target_metric: 'sales' }).queries;
  expect(query.metrics).toEqual(['sales']);
});

test('buildQuery computes the marker line metric in a second, ungrouped query', () => {
  const { queries } = buildQuery({
    ...formData,
    orderby: [['sales', false]],
    marker_line_metric: 'avg_rate',
  });
  expect(queries).toHaveLength(2);
  expect(queries[0].metrics).toEqual(['sales']);
  expect(queries[1].columns).toEqual([]);
  expect(queries[1].metrics).toEqual(['avg_rate']);
  expect(queries[1].orderby).toEqual([]);
});

test('each row gets a target tick at its own target value', () => {
  const { series, xAxis } = options({ targetMetric: 'quota', ranges: '50' });
  const targets = series.find((s: any) => s.name === 'quota');
  expect(targets.data.map((d: any) => d.value)).toEqual([
    [90, 0],
    [60, 1],
  ]);
  // the axis stretches to fit the largest target
  expect(xAxis.max).toBe(90);
});

test('rows without a target value get no target tick', () => {
  const { series } = options({ targetMetric: 'quota' }, [
    { data: [rows[0], { region: 'North', sales: 50, quota: null }] },
  ]);
  const targets = series.find((s: any) => s.name === 'quota');
  expect(targets.data).toHaveLength(1);
});

test('the marker line metric draws one chart-wide line labelled by the metric', () => {
  const { series, xAxis } = options(
    {
      markerLines: '50',
      markerLineLabels: 'floor',
      markerLineMetric: 'avg_rate',
    },
    [{ data: rows }, { data: [{ avg_rate: 95 }] }],
  );
  const lines = series.filter((s: any) => s.type === 'line');
  expect(lines.map((s: any) => s.markLine.data[0].xAxis)).toEqual([50, 95]);
  expect(lines[1].markLine.data[0].label.formatter()).toBe('avg_rate');
  expect(xAxis.max).toBe(95);
});

test('relative ranges scale with each row target', () => {
  const { series } = options({
    targetMetric: 'quota',
    ranges: '50,100',
    rangesRelative: true,
  });
  // per-row bands replace the chart-wide markArea
  expect(series[0].markArea.data).toEqual([]);
  const bands = series.filter((s: any) => s.type === 'custom');
  // largest band first, one [start, end, row] item per row
  expect(bands[0].data).toEqual([
    [0, 90, 0],
    [0, 60, 1],
  ]);
  expect(bands[1].data).toEqual([
    [0, 45, 0],
    [0, 30, 1],
  ]);
});

test('relative ranges fall back to absolute ranges without a target metric', () => {
  const { series } = options({ ranges: '50,100', rangesRelative: true });
  expect(series.filter((s: any) => s.type === 'custom')).toHaveLength(0);
  expect(series[0].markArea.data.map((d: any) => d[1].xAxis)).toEqual([
    100, 50,
  ]);
});
