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
import { buildSortMetricOrderby } from '../../src';

test('is a no-op when there is no sort metric and no fallback', () => {
  const result = buildSortMetricOrderby({
    metrics: ['sum__num'],
    timeseriesLimitMetric: undefined,
  });
  expect(result).toEqual({ metrics: ['sum__num'], orderby: [] });
});

test('falls back to the first metric when configured to', () => {
  const result = buildSortMetricOrderby({
    metrics: ['sum__num', 'avg__num'],
    timeseriesLimitMetric: undefined,
    fallbackToFirstMetric: true,
  });
  expect(result.metrics).toEqual(['sum__num', 'avg__num']);
  expect(result.orderby).toEqual([['sum__num', true]]);
});

test('appends the sort metric when it is not already selected', () => {
  const result = buildSortMetricOrderby({
    metrics: ['sum__num'],
    timeseriesLimitMetric: 'count',
  });
  expect(result.metrics).toEqual(['sum__num', 'count']);
});

test('does not duplicate the sort metric when already selected', () => {
  const result = buildSortMetricOrderby({
    metrics: ['sum__num', 'count'],
    timeseriesLimitMetric: 'count',
  });
  expect(result.metrics).toEqual(['sum__num', 'count']);
});

test('unconditional ordering (orderOnlyWhenDesc: false) always orders, flipping direction', () => {
  const ascending = buildSortMetricOrderby({
    metrics: ['sum__num'],
    timeseriesLimitMetric: 'count',
    order_desc: false,
  });
  expect(ascending.orderby).toEqual([['count', true]]);

  const descending = buildSortMetricOrderby({
    metrics: ['sum__num'],
    timeseriesLimitMetric: 'count',
    order_desc: true,
  });
  expect(descending.orderby).toEqual([['count', false]]);
});

test('gated ordering (orderOnlyWhenDesc: true) only orders when order_desc is set', () => {
  const withoutDesc = buildSortMetricOrderby({
    metrics: ['sum__num'],
    timeseriesLimitMetric: 'count',
    orderOnlyWhenDesc: true,
  });
  expect(withoutDesc.metrics).toEqual(['sum__num', 'count']);
  expect(withoutDesc.orderby).toEqual([]);

  const withDesc = buildSortMetricOrderby({
    metrics: ['sum__num'],
    timeseriesLimitMetric: 'count',
    order_desc: true,
    orderOnlyWhenDesc: true,
  });
  expect(withDesc.orderby).toEqual([['count', false]]);
});

test('resolves a multi-value timeseriesLimitMetric to its first entry', () => {
  const result = buildSortMetricOrderby({
    metrics: ['sum__num'],
    timeseriesLimitMetric: ['count', 'avg__num'],
  });
  expect(result.metrics).toEqual(['sum__num', 'count']);
  expect(result.orderby).toEqual([['count', true]]);
});
