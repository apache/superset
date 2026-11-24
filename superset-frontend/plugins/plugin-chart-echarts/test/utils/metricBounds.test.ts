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
import { AdhocMetric } from '@superset-ui/core';
import { getMetricValue, resolveBound } from '../../src/utils/metricBounds';

const sumQuota: AdhocMetric = {
  expressionType: 'SIMPLE',
  column: { column_name: 'quota' },
  aggregate: 'SUM',
};

test('resolveBound prefers the metric value, then the typed value, then the fallback', () => {
  const fallback = jest.fn(() => 7);
  expect(resolveBound({ fromMetric: 90, fixed: 100, fallback })).toBe(90);
  expect(resolveBound({ fromMetric: undefined, fixed: '100', fallback })).toBe(
    100,
  );
  expect(fallback).not.toHaveBeenCalled();
  expect(resolveBound({ fromMetric: undefined, fixed: null, fallback })).toBe(
    7,
  );
  expect(resolveBound({ fromMetric: undefined, fixed: '', fallback })).toBe(7);
  // zero is a real metric value, not a missing one
  expect(resolveBound({ fromMetric: 0, fixed: 100, fallback })).toBe(0);
});

test('getMetricValue reads saved and adhoc metrics by label', () => {
  const row = { total_quota: 90, 'SUM(quota)': '75', empty: null };
  expect(getMetricValue(row, 'total_quota')).toBe(90);
  expect(getMetricValue(row, sumQuota)).toBe(75);
  expect(getMetricValue(row, 'empty')).toBeUndefined();
  expect(getMetricValue(row, 'missing')).toBeUndefined();
  expect(getMetricValue(row, null)).toBeUndefined();
  expect(getMetricValue(undefined, 'total_quota')).toBeUndefined();
  expect(getMetricValue({ x: 'abc' }, 'x')).toBeUndefined();
});
