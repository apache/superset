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

it('generates proper time range string', () => {
  expect(
    buildTimeRangeString('2010-07-30T00:00:00', '2020-07-30T00:00:00'),
  ).toBe('2010-07-30T00:00:00 : 2020-07-30T00:00:00');
  expect(buildTimeRangeString('', '2020-07-30T00:00:00')).toBe(
    ' : 2020-07-30T00:00:00',
  );
  expect(buildTimeRangeString('', '')).toBe(' : ');
});

it('generates a readable time range', () => {
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

it('returns a formatted time range from response', async () => {
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

it('returns a formatted time range from empty response', async () => {
  fetchMock.get("glob:*/api/v1/time_range/?q='Last+day'", {
    result: [],
  });

  const timeRange = await fetchTimeRange('Last day');
  expect(timeRange).toEqual({
    value: '-∞ ≤ col < ∞',
  });
});

it('returns a formatted error message from response', async () => {
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

it('generates a readable time range comparison', () => {
  expect(
    formatTimeRangeComparison(
      '2021-04-13T00:00:00 : 2021-04-14T00:00:00',
      '2021-04-15T00:00:00 : 2021-04-16T00:00:00',
      'col',
    )
      .replace(/\s+/g, ' ')
      .trim(),
  ).toBe('col: 2021-04-13 to 2021-04-14 vs 2021-04-15 to 2021-04-16');
});

it('uses default column placeholder when none is provided', () => {
  const initialTimeRange = '2021-04-13T00:00:00 : 2021-04-14T00:00:00';
  const shiftedTimeRange = '2021-04-15T00:00:00 : 2021-04-16T00:00:00';
  const expectedOutput =
    'col: 2021-04-13 to 2021-04-14 vs 2021-04-15 to 2021-04-16';

  // Call the function without the third parameter
  const actualOutput = formatTimeRangeComparison(
    initialTimeRange,
    shiftedTimeRange,
  )
    .replace(/\s+/g, ' ')
    .trim();

  expect(actualOutput).toBe(expectedOutput);
});

it('returns a comparison of formatted time ranges with shifts', async () => {
  // Correcting the fetchMock to properly mock the API request and response
  fetchMock.get('glob:*/api/v1/time_range/?q=*', {
    body: {
      result: [
        { since: '2022-01-01T00:00:00', until: '2022-01-02T00:00:00' },
        { since: '2022-01-03T00:00:00', until: '2022-01-04T00:00:00' },
      ],
    },
    headers: { 'Content-Type': 'application/json' },
  });

  const shifts = ['1 day', '2 days']; // Define shifts if your implementation requires them
  const timeRange = await fetchTimeRange(
    '2022-01-01T00:00:00 : 2022-01-02T00:00:00',
    'col',
    shifts,
  );

  // Since `fetchTimeRange` might be returning multiple comparisons, ensure the test checks this correctly.
  // Assuming `fetchTimeRange` returns an object with an array in `value`, representing each comparison
  expect(timeRange).toEqual({
    value: [
      `col: 2022-01-01 to 2022-01-02 vs
  2022-01-03 to 2022-01-04`,
    ],
  });
});

it('returns a formatted error message from response with shifts', async () => {
  fetchMock.getOnce('glob:*/api/v1/time_range/?q=*', {
    throws: new Response(JSON.stringify({ message: 'Network error' })),
  });

  const shifts = ['1 day', '2 days']; // Define shifts if your implementation requires them
  const timeRange = await fetchTimeRange(
    '2022-01-01T00:00:00 : 2022-01-02T00:00:00',
    'col',
    shifts,
  );
  expect(timeRange).toEqual({
    error: 'Network error',
  });
});
