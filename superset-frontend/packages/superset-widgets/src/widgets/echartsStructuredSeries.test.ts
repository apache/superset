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
  applyStructuredEchartsSeries,
  buildStructuredSeries,
} from './echartsStructuredSeries';

const ROWS = [
  { count: 3, sum__sales: 100 },
  { count: 5, sum__sales: 200 },
];

test('custom/unset mode (no chartType) leaves the raw option untouched, including mixed-series shapes', () => {
  const raw = { series: [{ type: 'pie', data: [{ name: 'a', value: 1 }] }] };
  expect(
    applyStructuredEchartsSeries(raw, undefined, ['count'], ROWS, undefined),
  ).toBe(raw);
  expect(
    applyStructuredEchartsSeries(raw, null, ['count'], ROWS, undefined),
  ).toBe(raw);
});

test('a structured chart type generates one series per metric, keyed and typed correctly', () => {
  const series = buildStructuredSeries(
    'bar',
    ['count', 'sum__sales'],
    ROWS,
    undefined,
  );
  expect(series).toEqual([
    {
      name: 'count',
      type: 'bar',
      data: [3, 5],
      itemStyle: { color: '#e74c3c' },
    },
    {
      name: 'sum__sales',
      type: 'bar',
      data: [100, 200],
      itemStyle: { color: '#3498db' },
    },
  ]);
});

test('an uncustomized series falls back to the same per-index palette default the schema advertises as its color, not to whatever ECharts would otherwise pick', () => {
  const series = buildStructuredSeries('bar', ['count'], ROWS, undefined);
  expect(series[0].itemStyle).toEqual({ color: '#e74c3c' });
});

test('an ad-hoc metric is keyed by its stable getMetricLabel, not its raw shape', () => {
  const rows = [{ 'AVG(price)': 10 }];
  const series = buildStructuredSeries(
    'line',
    [
      {
        expressionType: 'SIMPLE',
        aggregate: 'AVG',
        column: { columnName: 'price' },
      } as never,
    ],
    rows,
    undefined,
  );
  expect(series[0].name).toBe('AVG(price)');
  expect(series[0].data).toEqual([10]);
  expect(series[0].itemStyle).toEqual({ color: '#e74c3c' });
});

test('a series override applies color and display name by stable metric key', () => {
  const series = buildStructuredSeries('line', ['count'], ROWS, {
    count: { color: '#3498db', displayName: 'Total count' },
  });
  expect(series).toEqual([
    {
      name: 'Total count',
      type: 'line',
      data: [3, 5],
      itemStyle: { color: '#3498db' },
    },
  ]);
});

test('visible: false omits that series entirely, not just hides it', () => {
  const series = buildStructuredSeries('bar', ['count', 'sum__sales'], ROWS, {
    sum__sales: { visible: false },
  });
  expect(series).toHaveLength(1);
  expect(series[0].name).toBe('count');
});

test('an override for a metric no longer in dataBinding.metrics is silently ignored, not an error', () => {
  const series = buildStructuredSeries('bar', ['count'], ROWS, {
    stale__metric: { color: '#9b59b6' },
  });
  expect(series).toEqual([
    {
      name: 'count',
      type: 'bar',
      data: [3, 5],
      itemStyle: { color: '#e74c3c' },
    },
  ]);
});

test('unmanaged raw ECharts properties survive the merge — only series is replaced', () => {
  const raw = {
    title: { text: 'Sales' },
    legend: { show: true },
    xAxis: { type: 'category', data: ['a', 'b'] },
    tooltip: { trigger: 'axis' },
    series: [{ type: 'pie', data: [] }],
  };
  const merged = applyStructuredEchartsSeries(
    raw,
    'bar',
    ['count'],
    ROWS,
    undefined,
  );
  expect(merged.title).toBe(raw.title);
  expect(merged.legend).toBe(raw.legend);
  expect(merged.xAxis).toBe(raw.xAxis);
  expect(merged.tooltip).toBe(raw.tooltip);
  expect(merged.series).toEqual([
    {
      name: 'count',
      type: 'bar',
      data: [3, 5],
      itemStyle: { color: '#e74c3c' },
    },
  ]);
});
