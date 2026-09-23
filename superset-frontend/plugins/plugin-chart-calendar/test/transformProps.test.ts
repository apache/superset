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
import { supersetTheme } from '@apache-superset/core/theme';
import { ChartProps } from '@superset-ui/core';
import transformProps from '../src/transformProps';

const baseChartProps = {
  width: 800,
  height: 600,
  datasource: { verboseMap: { SUM__value: 'Sum value' } },
  theme: supersetTheme,
  hooks: {},
};

const formData = {
  metrics: ['SUM__value'],
  domainGranularity: 'month',
  subdomainGranularity: 'day',
  linearColorScheme: 'schemeRdYlBu',
  cellSize: 10,
  cellPadding: 2,
  cellRadius: 0,
  steps: 10,
  yAxisFormat: '.2f',
  xAxisTimeFormat: '%b %d',
  showLegend: true,
  showValues: false,
  showMetricName: true,
  sliceId: 1,
};

test('reshapes v1 records into calendar data and passes through display options', () => {
  const chartProps = new ChartProps({
    ...baseChartProps,
    formData,
    queriesData: [
      {
        data: [
          { __timestamp: Date.UTC(2020, 0, 1), SUM__value: 3 },
          { __timestamp: Date.UTC(2020, 0, 2), SUM__value: 7 },
        ],
        from_dttm: Date.UTC(2020, 0, 1),
        to_dttm: Date.UTC(2020, 0, 31),
      },
    ],
  });

  const result = transformProps(chartProps) as Record<string, unknown>;

  // The reshape produces a per-metric value map, and the display controls and
  // formatters are forwarded to the chart.
  expect(result.data).toBeDefined();
  expect(result.domainGranularity).toBe('month');
  expect(result.subdomainGranularity).toBe('day');
  expect(result.cellSize).toBe(10);
  expect(result.showMetricName).toBe(true);
  expect(typeof result.timeFormatter).toBe('function');
  expect(typeof result.valueFormatter).toBe('function');
  expect(result.verboseMap).toEqual({ SUM__value: 'Sum value' });
});

test('passes through non-array data untouched (already-shaped payload)', () => {
  const preShaped = { SUM__value: { 1577836800000: 3 } };
  const chartProps = new ChartProps({
    ...baseChartProps,
    formData,
    queriesData: [{ data: preShaped, from_dttm: null, to_dttm: null }],
  });

  const result = transformProps(chartProps) as Record<string, unknown>;
  expect(result.data).toBe(preShaped);
});
