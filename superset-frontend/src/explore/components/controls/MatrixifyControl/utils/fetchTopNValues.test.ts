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
import { getChartDataRequest } from 'src/components/Chart/chartAction';
import { extractDimensionValues, fetchTopNValues } from './fetchTopNValues';

jest.mock('src/components/Chart/chartAction', () => ({
  getChartDataRequest: jest.fn(),
}));

const mockGetChartDataRequest = getChartDataRequest as jest.Mock;

const baseParams = {
  datasource: '1__table',
  column: 'country',
  metric: 'count',
  limit: 5,
};

const respondWith = (json: unknown) =>
  mockGetChartDataRequest.mockResolvedValueOnce({ json });

beforeEach(() => {
  mockGetChartDataRequest.mockReset();
});

test('builds a table-viz chart-data request from the params', async () => {
  respondWith({ result: [{ data: [] }] });
  const filters = [
    {
      expressionType: 'SIMPLE',
      clause: 'WHERE',
      subject: 'year',
      operator: '==',
      comparator: 2024,
    },
  ];

  await fetchTopNValues({
    ...baseParams,
    sortAscending: true,
    filters,
    timeRange: 'Last week',
  });

  expect(mockGetChartDataRequest).toHaveBeenCalledTimes(1);
  expect(mockGetChartDataRequest).toHaveBeenCalledWith({
    formData: {
      datasource: '1__table',
      groupby: ['country'],
      metrics: ['count'],
      adhoc_filters: filters,
      time_range: 'Last week',
      row_limit: 5,
      orderby: [['count', true]],
      viz_type: 'table',
    },
    force: false,
  });
});

test('defaults to descending order, no filters and no time range', async () => {
  respondWith({ result: [{ data: [] }] });

  await fetchTopNValues(baseParams);

  const { formData } = mockGetChartDataRequest.mock.calls[0][0];
  expect(formData.orderby).toEqual([['count', false]]);
  expect(formData.adhoc_filters).toEqual([]);
  expect(formData.time_range).toBeUndefined();
});

test('maps result rows to value and metricValue', async () => {
  respondWith({
    result: [
      {
        data: [
          { country: 'US', count: 30, extra: 'ignored' },
          { country: 'FR', count: 20 },
          { country: 7, count: 10 },
        ],
      },
    ],
  });

  const values = await fetchTopNValues(baseParams);

  expect(values).toEqual([
    { value: 'US', metricValue: 30 },
    { value: 'FR', metricValue: 20 },
    { value: 7, metricValue: 10 },
  ]);
});

test('reads values from the requested column and metric names', async () => {
  respondWith({
    result: [{ data: [{ region: 'EMEA', 'SUM(sales)': 99, country: 'US' }] }],
  });

  const values = await fetchTopNValues({
    ...baseParams,
    column: 'region',
    metric: 'SUM(sales)',
  });

  expect(values).toEqual([{ value: 'EMEA', metricValue: 99 }]);
});

test('returns an empty array for an empty result set', async () => {
  respondWith({ result: [{ data: [] }] });

  await expect(fetchTopNValues(baseParams)).resolves.toEqual([]);
});

test.each([
  ['the response has no json', undefined],
  ['json has no result', {}],
  ['result is empty', { result: [] }],
  ['the first result has no data', { result: [{}] }],
])('returns an empty array when %s', async (_label, json) => {
  respondWith(json);

  await expect(fetchTopNValues(baseParams)).resolves.toEqual([]);
});

test('logs and re-throws when the request rejects', async () => {
  const error = new Error('request failed');
  mockGetChartDataRequest.mockRejectedValueOnce(error);
  const consoleError = jest.spyOn(console, 'error').mockImplementation();

  try {
    await expect(fetchTopNValues(baseParams)).rejects.toBe(error);
    expect(consoleError).toHaveBeenCalledWith(expect.any(String), error);
  } finally {
    consoleError.mockRestore();
  }
});

test('extractDimensionValues returns only the values', () => {
  expect(
    extractDimensionValues([
      { value: 'US', metricValue: 30 },
      { value: 7, metricValue: 10 },
    ]),
  ).toEqual(['US', 7]);
});

test('extractDimensionValues returns an empty array for no input', () => {
  expect(extractDimensionValues([])).toEqual([]);
});
