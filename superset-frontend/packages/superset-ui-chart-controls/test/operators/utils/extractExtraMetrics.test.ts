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
import { QueryFormData, QueryFormMetric } from '@superset-ui/core';
import { extractExtraMetrics } from '@superset-ui/chart-controls';

const baseFormData: QueryFormData = {
  datasource: 'dummy',
  viz_type: 'table',
  metrics: ['a', 'b'],
  columns: ['foo', 'bar'],
  limit: 100,
  metrics_b: ['c', 'd'],
  columns_b: ['hello', 'world'],
  limit_b: 200,
};

const metric: QueryFormMetric = {
  expressionType: 'SQL',
  sqlExpression: 'case when 1 then 1 else 2 end',
  label: 'foo',
};

test('returns empty array if relevant controls missing', () => {
  expect(
    extractExtraMetrics({
      ...baseFormData,
    }),
  ).toEqual([]);
});

test('returns empty array if x_axis_sort is not same as timeseries_limit_metric', () => {
  expect(
    extractExtraMetrics({
      ...baseFormData,
      timeseries_limit_metric: 'foo',
      x_axis_sort: 'bar',
    }),
  ).toEqual([]);
});

test('returns correct column if sort columns match', () => {
  expect(
    extractExtraMetrics({
      ...baseFormData,
      timeseries_limit_metric: 'foo',
      x_axis_sort: 'foo',
    }),
  ).toEqual(['foo']);
});

test('handles adhoc metrics correctly', () => {
  expect(
    extractExtraMetrics({
      ...baseFormData,
      timeseries_limit_metric: metric,
      x_axis_sort: 'foo',
    }),
  ).toEqual([metric]);

  expect(
    extractExtraMetrics({
      ...baseFormData,
      timeseries_limit_metric: metric,
      x_axis_sort: 'bar',
    }),
  ).toEqual([]);
});

test('returns empty array if groupby populated', () => {
  expect(
    extractExtraMetrics({
      ...baseFormData,
      groupby: ['bar'],
      timeseries_limit_metric: 'foo',
      x_axis_sort: 'foo',
    }),
  ).toEqual([]);
});

test('returns empty array if timeseries_limit_metric and x_axis_sort are included in main metrics array', () => {
  expect(
    extractExtraMetrics({
      ...baseFormData,
      timeseries_limit_metric: 'a',
      x_axis_sort: 'a',
    }),
  ).toEqual([]);
});

test('returns empty array if timeseries_limit_metric and x_axis_sort are included in main metrics array with adhoc metrics', () => {
  expect(
    extractExtraMetrics({
      ...baseFormData,
      metrics: [
        'a',
        {
          expressionType: 'SIMPLE',
          aggregate: 'SUM',
          column: { column_name: 'num' },
        },
      ],
      timeseries_limit_metric: {
        expressionType: 'SIMPLE',
        aggregate: 'SUM',
        column: { column_name: 'num' },
      },
      x_axis_sort: 'SUM(num)',
    }),
  ).toEqual([]);
});

test('returns empty array if timeseries_limit_metric is an empty array', () => {
  expect(
    extractExtraMetrics({
      ...baseFormData,
      // @ts-ignore
      timeseries_limit_metric: [],
    }),
  ).toEqual([]);
});
