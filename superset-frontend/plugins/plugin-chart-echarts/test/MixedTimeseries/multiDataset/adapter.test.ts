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
import { ChartDataResponseResult, QueryFormData } from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/common';
import { MixedTimeseriesResponseAdapter } from '../../../src/MixedTimeseries/multiDataset/adapter';
import { MultiDatasetResponseError } from '../../../src/MixedTimeseries/multiDataset/types';

const result = (
  overrides: Partial<ChartDataResponseResult> = {},
): ChartDataResponseResult =>
  ({
    data: [],
    colnames: [],
    coltypes: [],
    error: null,
    is_cached: false,
    ...overrides,
  }) as unknown as ChartDataResponseResult;

const resultA = result({
  colnames: ['ds', 'sum(sales)'],
  coltypes: [GenericDataType.Temporal, GenericDataType.Numeric],
  data: [{ ds: 1, 'sum(sales)': 10 }],
});

const resultB = result({
  colnames: ['order_date', 'sum(spend)'],
  coltypes: [GenericDataType.Temporal, GenericDataType.Numeric],
  data: [
    { order_date: 1, 'sum(spend)': 5 },
    { order_date: 2, 'sum(spend)': 7 },
  ],
});

const formData = (xAxis: string, xAxisB: string) =>
  ({ x_axis: xAxis, x_axis_b: xAxisB }) as unknown as QueryFormData;

test('combineResponses returns [resultA, resultB] in chart order', () => {
  const adapter = new MixedTimeseriesResponseAdapter(formData('ds', 'ds'));
  const sameLabelB = result({
    colnames: ['ds', 'sum(spend)'],
    data: [{ ds: 1, 'sum(spend)': 5 }],
  });
  const combined = adapter.combineResponses([resultA], [sameLabelB]);
  expect(combined).toHaveLength(2);
  expect(combined[0]).toBe(resultA);
  expect(combined[1]).toBe(sameLabelB);
});

test('B X-axis is re-keyed to the A label in rows and colnames', () => {
  const adapter = new MixedTimeseriesResponseAdapter(
    formData('ds', 'order_date'),
  );
  const [, combinedB] = adapter.combineResponses([resultA], [resultB]);

  expect(combinedB.colnames).toEqual(['ds', 'sum(spend)']);
  expect(combinedB.coltypes).toEqual(resultB.coltypes);
  expect(combinedB.data).toEqual([
    { ds: 1, 'sum(spend)': 5 },
    { ds: 2, 'sum(spend)': 7 },
  ]);
});

test('combineResponses does not mutate its inputs', () => {
  const snapshotB = JSON.parse(JSON.stringify(resultB));
  const adapter = new MixedTimeseriesResponseAdapter(
    formData('ds', 'order_date'),
  );
  adapter.combineResponses([resultA], [resultB]);
  expect(resultB).toEqual(snapshotB);
});

test('re-keying onto an existing B column is rejected', () => {
  const adapter = new MixedTimeseriesResponseAdapter(
    formData('ds', 'order_date'),
  );
  const clashing = result({
    colnames: ['order_date', 'ds'],
    data: [{ order_date: 1, ds: 'x' }],
  });
  expect(() => adapter.combineResponses([resultA], [clashing])).toThrow(
    MultiDatasetResponseError,
  );
});

test('a response with no result is rejected', () => {
  const adapter = new MixedTimeseriesResponseAdapter(formData('ds', 'ds'));
  expect(() => adapter.validateResponses([], [resultB])).toThrow(
    'Query A returned an unexpected number of results.',
  );
});

test('a response with several results is rejected', () => {
  const adapter = new MixedTimeseriesResponseAdapter(formData('ds', 'ds'));
  expect(() =>
    adapter.validateResponses([resultA], [resultB, resultB]),
  ).toThrow('Query B returned an unexpected number of results.');
});

test('a result carrying an error is rejected with its message', () => {
  const adapter = new MixedTimeseriesResponseAdapter(formData('ds', 'ds'));
  const failed = result({ error: 'relation does not exist' });
  expect(() => adapter.validateResponses([resultA], [failed])).toThrow(
    'Query B failed: relation does not exist',
  );
});

test('a result without data is rejected', () => {
  const adapter = new MixedTimeseriesResponseAdapter(formData('ds', 'ds'));
  const noData = { error: null } as unknown as ChartDataResponseResult;
  expect(() => adapter.validateResponses([noData], [resultB])).toThrow(
    'Query A returned no data.',
  );
});

test('empty data is accepted', () => {
  const adapter = new MixedTimeseriesResponseAdapter(formData('ds', 'ds'));
  expect(() =>
    adapter.validateResponses([resultA], [result({ colnames: ['ds'] })]),
  ).not.toThrow();
});
