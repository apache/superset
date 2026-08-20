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
  columnOptions,
  hasAdvancedMetric,
  metricOptions,
} from './schemaControlRenderers';

test('columnOptions filters by x-column-types when given', () => {
  const metadata = {
    columns: [
      { name: 'region', type: 1 },
      { name: 'sales', type: 0 },
    ],
    metrics: [],
  };
  expect(columnOptions(metadata, ['numeric']).map(o => o.value)).toEqual([
    'sales',
  ]);
});

test('columnOptions returns every column when no x-column-types hint is given', () => {
  const metadata = {
    columns: [
      { name: 'region', type: 1 },
      { name: 'sales', type: 0 },
    ],
    metrics: [],
  };
  expect(columnOptions(metadata, undefined).map(o => o.value)).toEqual([
    'region',
    'sales',
  ]);
});

test('columnOptions returns an empty list when metadata has not loaded yet', () => {
  expect(columnOptions(null, undefined)).toEqual([]);
});

test("metricOptions lists the dataset's saved metrics by verbose name", () => {
  const metadata = {
    columns: [],
    metrics: [{ name: 'count', verboseName: 'Count' }],
  };
  expect(metricOptions(metadata).map(o => o.value)).toEqual(['count']);
});

test('hasAdvancedMetric is false when every value is a known saved metric', () => {
  const metadata = {
    columns: [],
    metrics: [{ name: 'count', verboseName: 'Count' }],
  };
  expect(hasAdvancedMetric(['count'], metadata)).toBe(false);
});

test('hasAdvancedMetric is true for an ad-hoc aggregate object', () => {
  const metadata = {
    columns: [],
    metrics: [{ name: 'count', verboseName: 'Count' }],
  };
  expect(
    hasAdvancedMetric(
      [{ expressionType: 'SIMPLE', aggregate: 'SUM' }],
      metadata,
    ),
  ).toBe(true);
});

test('hasAdvancedMetric is true for a metric name the dataset does not have', () => {
  const metadata = {
    columns: [],
    metrics: [{ name: 'count', verboseName: 'Count' }],
  };
  expect(hasAdvancedMetric(['unknown_metric'], metadata)).toBe(true);
});
