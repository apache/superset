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

import fetchMock from 'fetch-mock';
import { fetchTimeRange } from '@superset-ui/core';
import {
  buildTimeRangeString,
  formatTimeRange,
  formatTimeRangeComparison,
} from '../../src/time-comparison/fetchTimeRange';

afterEach(fetchMock.restore);

test('generates proper time range string', () => {
  expect(
    buildTimeRangeString('2010-07-30T00:00:00', '2020-07-30T00:00:00'),
  ).toBe('2010-07-30T00:00:00 : 2020-07-30T00:00:00');
  expect(buildTimeRangeString('', '2020-07-30T00:00:00')).toBe(
    ' : 2020-07-30T00:00:00',
  );
  expect(buildTimeRangeString('', '')).toBe(' : ');
});

test('generates a readable time range', () => {
  expect(formatTimeRange('Last 7 days')).toBe('Last 7 days');
  expect(formatTimeRange('No filter')).toBe('No filter');
  expect(formatTimeRange('Yesterday : Tomorrow')).toBe(
    'Yesterday ≤ col < Tomorrow',
  );
  expect(formatTimeRange('2010-07-30T00:00:00 : 2020-07-30T00:00:00')).toBe(
    '2010-07-30 ≤ col < 2020-07-30',
  );
  expect(formatTimeRange('2010-07-30T01:00:00 : ')).toBe(
    '2010-07-30T01:00:00 ≤ col < ∞',
  );
  expect(formatTimeRange(' : 2020-07-30T00:00:00')).toBe(
    '-∞ ≤ col < 2020-07-30',
  );
  expect(formatTimeRange('')).toBe('');
});

test('returns a formatted time range from response', async () => {
  fetchMock.get("glob:*/api/v1/time_range/?q='Last+day'", {
    result: [
      {
        since: '2021-04-13T00:00:00',
        until: '2021-04-14T00:00:00',
        timeRange: 'Last day',
      },
    ],
  });

  const timeRange = await fetchTimeRange('Last day', 'temporal_col');
  expect(timeRange).toEqual({
    value: '2021-04-13 ≤ temporal_col < 2021-04-14',
  });
});

test('returns a formatted time range from empty response', async () => {
  fetchMock.get("glob:*/api/v1/time_range/?q='Last+day'", {
    result: [],
  });

  const timeRange = await fetchTimeRange('Last day');
  expect(timeRange).toEqual({
    value: '-∞ ≤ col < ∞',
  });
});

test('returns a formatted error message from response', async () => {
  fetchMock.getOnce("glob:*/api/v1/time_range/?q='Last+day'", {
    throws: new Response(JSON.stringify({ message: 'Network error' })),
  });
  let timeRange = await fetchTimeRange('Last day');
  expect(timeRange).toEqual({
    error: 'Network error',
  });

  fetchMock.getOnce(
    "glob:*/api/v1/time_range/?q='Last+day'",
    {
      throws: new Error('Internal Server Error'),
    },
    { overwriteRoutes: true },
  );
  timeRange = await fetchTimeRange('Last day');
  expect(timeRange).toEqual({
    error: 'Internal Server Error',
  });

  fetchMock.getOnce(
    "glob:*/api/v1/time_range/?q='Last+day'",
    {
      throws: new Response(JSON.stringify({ statusText: 'Network error' }), {
        statusText: 'Network error',
      }),
    },
    { overwriteRoutes: true },
  );
  timeRange = await fetchTimeRange('Last day');
  expect(timeRange).toEqual({
    error: 'Network error',
  });
});

test('fetchTimeRange with shift', async () => {
  fetchMock.getOnce(
    "glob:*/api/v1/time_range/?q=!((timeRange:'Last+day'),(shift%3A'last%20month'%2CtimeRange%3A'Last%20day'))",
    {
      result: [
        {
          since: '2021-04-13T00:00:00',
          until: '2021-04-14T00:00:00',
          timeRange: 'Last day',
          shift: null,
        },
        {
          since: '2021-03-13T00:00:00',
          until: '2021-03-14T00:00:00',
          timeRange: 'Last day',
          shift: 'last month',
        },
      ],
    },
  );

  const timeRange = await fetchTimeRange('Last day', 'temporal_col', [
    'last month',
  ]);

  expect(timeRange).toEqual({
    value: [
      'temporal_col: 2021-04-13 to 2021-04-14 vs\n  2021-03-13 to 2021-03-14',
    ],
  });
});

test('formatTimeRangeComparison', () => {
  expect(
    formatTimeRangeComparison(
      '2021-04-13T00:00:00 : 2021-04-14T00:00:00',
      '2021-03-13T00:00:00 : 2021-03-14T00:00:00',
    ),
  ).toEqual('col: 2021-04-13 to 2021-04-14 vs\n  2021-03-13 to 2021-03-14');

  expect(
    formatTimeRangeComparison(
      '2021-04-13T00:00:00 : 2021-04-14T00:00:00',
      '2021-03-13T00:00:00 : 2021-03-14T00:00:00',
      'col_name',
    ),
  ).toEqual(
    'col_name: 2021-04-13 to 2021-04-14 vs\n  2021-03-13 to 2021-03-14',
  );
});
